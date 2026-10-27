// Voice-over build: studio MP3s -> shipped Ogg Opus clips + generated line map with word timings.
//   node tools/vo_build.mjs [voiceovers_batch.zip ...] [--mp3dir <dir>]
// Safe to re-run. Steps:
//   1. collect MP3s (from zips and/or the work dir)
//   2. in headless Chrome: decode, measure speech/pauses, encode Opus (WebCodecs, 32 kbps mono)
//   3. mux Ogg Opus (RFC 7845, granules at 48 kHz) -> assets/vo/voNNN.ogg
//   4. word timings: syllable weights spread over the VOICED time (detected pauses removed),
//      so each word of the displayed line is revealed as it is spoken
//   5. write src/vo_lines.js (generated) and report missing clips + pace outliers

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readZip } from './vo_zip.mjs';
import { numberWords } from '../src/data/narration.js';

const args = process.argv.slice(2);
const WORK = path.resolve(process.env.VO_WORK || 'vo-work');
const MP3DIR = path.resolve(args.includes('--mp3dir') ? args[args.indexOf('--mp3dir') + 1] : path.join(WORK, 'mp3'));
const OUTDIR = path.resolve('assets/vo');
const BROWSER = process.env.QA_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync(MP3DIR, { recursive: true });
fs.mkdirSync(OUTDIR, { recursive: true });

// ---------- 1. collect ----------
for (const z of args.filter((a) => a.endsWith('.zip'))) {
  for (const e of readZip(fs.readFileSync(z))) {
    const m = e.name.match(/(vo\d+)\.mp3$/);
    if (m && e.data.length) fs.writeFileSync(path.join(MP3DIR, `${m[1]}.mp3`), e.data);
  }
}
const script = JSON.parse(fs.readFileSync('tools/vo_script.json', 'utf8'));
const clipIds = [...new Set(script.map((e) => e.clip))];
const available = clipIds.filter((id) => fs.existsSync(path.join(MP3DIR, `${id}.mp3`)));

// ---------- 2. decode / analyse / encode in the browser ----------
const PAGE = `<!doctype html><meta charset="utf-8"><script>
window.processClip = async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ctx = new OfflineAudioContext(1, 1, 48000);
  const buf = await ctx.decodeAudioData(bytes.buffer);
  let pcm = buf.getChannelData(0);
  if (buf.numberOfChannels > 1) { const r = buf.getChannelData(1); pcm = pcm.map((v, i) => (v + r[i]) / 2); }
  const F = 480; // 10 ms frames
  const env = [];
  for (let i = 0; i < pcm.length; i += F) { let s = 0; const n = Math.min(F, pcm.length - i); for (let k = 0; k < n; k++) s += pcm[i + k] * pcm[i + k]; env.push(10 * Math.log10(s / n + 1e-12)); }
  const packets = []; let description = null;
  const enc = new AudioEncoder({
    output: (chunk, meta) => { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); let s = ''; for (const b of d) s += String.fromCharCode(b); packets.push({ ts: chunk.timestamp, dur: chunk.duration, b64: btoa(s) }); if (meta?.decoderConfig?.description) { const u = new Uint8Array(meta.decoderConfig.description); let t = ''; for (const b of u) t += String.fromCharCode(b); description = btoa(t); } },
    error: (e) => { throw e; },
  });
  enc.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 32000 });
  enc.encode(new AudioData({ format: 'f32', sampleRate: 48000, numberOfFrames: pcm.length, numberOfChannels: 1, timestamp: 0, data: pcm }));
  await enc.flush();
  return { duration: pcm.length / 48000, samples: pcm.length, sourceRate: buf.sampleRate, env, packets, description };
};
</script>`;

// ---------- 3. Ogg Opus muxer ----------
const OGG_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let k = 0; k < 8; k++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();
function oggCrc(buf) {
  let c = 0;
  for (const b of buf) c = ((c << 8) ^ OGG_CRC[((c >>> 24) ^ b) & 0xff]) >>> 0;
  return c >>> 0;
}
function oggPage(packets, { granule, serial, seq, flags }) {
  const lacing = [];
  for (const p of packets) {
    let n = p.length;
    while (n >= 255) {
      lacing.push(255);
      n -= 255;
    }
    lacing.push(n);
  }
  const h = Buffer.alloc(27 + lacing.length);
  h.write('OggS', 0, 'ascii');
  h[4] = 0;
  h[5] = flags;
  h.writeBigInt64LE(BigInt(granule), 6);
  h.writeUInt32LE(serial, 14);
  h.writeUInt32LE(seq, 18);
  h.writeUInt32LE(0, 22);
  h[26] = lacing.length;
  lacing.forEach((v, i) => (h[27 + i] = v));
  const page = Buffer.concat([h, ...packets]);
  page.writeUInt32LE(oggCrc(page), 22);
  return page;
}
function muxOggOpus(res) {
  // OpusHead: prefer the encoder's own description (exact pre-skip), else build one
  let head = res.description ? Buffer.from(res.description, 'base64') : null;
  if (!head || head.toString('ascii', 0, 8) !== 'OpusHead') {
    head = Buffer.alloc(19);
    head.write('OpusHead', 0, 'ascii');
    head[8] = 1;
    head[9] = 1;
    head.writeUInt16LE(312, 10);
    head.writeUInt32LE(res.sourceRate || 24000, 12);
    head.writeInt16LE(0, 16);
    head[18] = 0;
  }
  head[9] = 1; // mono
  const preSkip = head.readUInt16LE(10);
  const vendor = Buffer.from('bridge-engineer vo_build (WebCodecs opus)');
  const tags = Buffer.alloc(8 + 4 + vendor.length + 4);
  tags.write('OpusTags', 0, 'ascii');
  tags.writeUInt32LE(vendor.length, 8);
  vendor.copy(tags, 12);
  tags.writeUInt32LE(0, 12 + vendor.length);
  const serial = (Math.random() * 0xffffffff) >>> 0;
  const pages = [oggPage([head], { granule: 0, serial, seq: 0, flags: 0x02 }), oggPage([tags], { granule: 0, serial, seq: 1, flags: 0 })];
  const pkts = res.packets.map((p) => ({ data: Buffer.from(p.b64, 'base64'), samples: Math.round((p.dur / 1e6) * 48000) || 960 }));
  const lastGranule = preSkip + res.samples; // trims encoder padding on the final page
  let granule = preSkip;
  let seq = 2;
  for (let i = 0; i < pkts.length; i += 50) {
    const group = pkts.slice(i, i + 50);
    granule += group.reduce((s, p) => s + p.samples, 0);
    const last = i + 50 >= pkts.length;
    pages.push(oggPage(group.map((p) => p.data), { granule: last ? lastGranule : Math.min(granule, lastGranule), serial, seq: seq++, flags: last ? 0x04 : 0 }));
  }
  return Buffer.concat(pages);
}

// ---------- 4. word timings ----------
// numbers weigh what the voice actually says ("118°" -> "one hundred and eighteen degrees")
function syllables(word) {
  let w = word.toLowerCase();
  w = w.replace(/(\d+(?:\.\d+)?)°/g, (_, n) => `${numberWords(+n)} degrees`).replace(/\d+(?:\.\d+)?/g, (n) => numberWords(+n));
  if (/^m[.,]?$/.test(w)) return 2; // "m" is said "metres"
  if (/^[<>=]$/.test(w)) return { '<': 3, '>': 3, '=': 2 }[w]; // less than / greater than / equals
  if (/^[·:–-]$/.test(w)) return 0;
  w = w.replace(/[^a-z\s-]/g, '');
  let n = 0;
  for (const part of w.split(/[\s-]+/)) {
    if (!part) continue;
    const g = part.replace(/e$/, '').match(/[aeiouy]+/g);
    n += Math.max(1, g ? g.length : 1);
  }
  return Math.max(n, 1);
}
/** Display tokens of a line, in reading order (exactly how the game splits them). */
export const tokensOf = (line) => line.split('\n').flatMap((p) => p.split(/\s+/).filter(Boolean));

function speechMap(env) {
  const peak = Math.max(...env);
  const thr = Math.max(-50, peak - 36);
  const voiced = env.map((v) => v > thr);
  let on = voiced.indexOf(true);
  let off = voiced.lastIndexOf(true);
  if (on < 0) return { on: 0, off: env.length * 0.01, gaps: [] };
  const gaps = [];
  for (let i = on; i <= off; i++) {
    if (voiced[i]) continue;
    let j = i;
    while (j <= off && !voiced[j]) j++;
    if (j - i >= 10) gaps.push([i * 0.01, j * 0.01]); // pauses >= 100 ms
    i = j;
  }
  return { on: Math.max(0, on * 0.01 - 0.02), off: Math.min(env.length * 0.01, off * 0.01 + 0.03), gaps };
}

/** Spread tokens [i0, i1) over [t0, t1] by weight, skipping the given pauses (voiced time only). */
function spread(weights, i0, i1, t0, t1, gaps) {
  const inner = gaps.filter(([a, b]) => a > t0 + 0.02 && b < t1 - 0.02);
  const voiced = t1 - t0 - inner.reduce((s, [a, b]) => s + (b - a), 0);
  const total = weights.slice(i0, i1).reduce((a, b) => a + b, 0) || 1;
  const toReal = (vt) => {
    let t = t0 + vt;
    for (const [a, b] of inner) {
      if (t >= a - 1e-6) t += b - a;
      else break;
    }
    return t;
  };
  const out = [];
  let acc = 0;
  for (let i = i0; i < i1; i++) {
    out.push(toReal((acc / total) * Math.max(0.05, voiced)));
    acc += weights[i];
  }
  return out;
}

/**
 * Word reveal times. Expected pauses (part breaks, sentence ends, commas) are matched to the
 * pauses detected in the audio with an order-preserving alignment (DP); words between two
 * matched pauses are spread over that stretch of speech by syllable weight.
 */
function wordTimes(line, sm) {
  const parts = line.split('\n').map((p) => p.split(/\s+/).filter(Boolean));
  const toks = parts.flat();
  const weights = toks.map((t) => (syllables(t) ? syllables(t) + 0.6 : 0)); // +0.6: every word has a minimum duration
  // expected pause after token i, with strength
  const bounds = [];
  let k = 0;
  parts.forEach((p, pi) => {
    p.forEach((t, ti) => {
      const last = ti === p.length - 1;
      const next = p[ti + 1];
      if (k < toks.length - 1) {
        if (last && pi < parts.length - 1) bounds.push({ i: k, s: 3 });
        else if (/[.?!]$/.test(t)) bounds.push({ i: k, s: 3 });
        else if (/[,;:]$/.test(t) || next === '·') bounds.push({ i: k, s: 1.5 });
      }
      k++;
    });
  });
  // prior: proportional prediction over the whole speech span
  const prior = spread(weights, 0, toks.length, sm.on, sm.off, sm.gaps);
  const predAfter = (i) => (i + 1 < toks.length ? prior[i + 1] : sm.off);
  const G = sm.gaps;
  const K = bounds.length;
  const M = G.length;
  const INF = 1e9;
  const dp = Array.from({ length: K + 1 }, () => new Array(M + 1).fill(INF));
  const from = Array.from({ length: K + 1 }, () => new Array(M + 1).fill(null));
  dp[0][0] = 0;
  for (let i = 0; i <= K; i++) {
    for (let j = 0; j <= M; j++) {
      const c = dp[i][j];
      if (c >= INF) continue;
      if (i < K && c + 0.35 * bounds[i].s < dp[i + 1][j]) {
        dp[i + 1][j] = c + 0.35 * bounds[i].s; // expected pause not found in the audio
        from[i + 1][j] = [i, j, null];
      }
      if (j < M) {
        const len = G[j][1] - G[j][0];
        const cost = c + 0.9 * Math.min(len, 0.6); // a real pause left unexplained
        if (cost < dp[i][j + 1]) {
          dp[i][j + 1] = cost;
          from[i][j + 1] = [i, j, null];
        }
      }
      if (i < K && j < M) {
        const len = G[j][1] - G[j][0];
        const cost = c + 0.8 * Math.abs(predAfter(bounds[i].i) - G[j][1]) - 0.5 * bounds[i].s * Math.min(len, 0.5);
        if (cost < dp[i + 1][j + 1]) {
          dp[i + 1][j + 1] = cost;
          from[i + 1][j + 1] = [i, j, j];
        }
      }
    }
  }
  // backtrack -> anchors: token (bound.i + 1) starts at the end of its matched pause
  const anchors = [];
  for (let i = K, j = M; i > 0 || j > 0; ) {
    const f = from[i][j];
    if (!f) break;
    if (f[2] != null) anchors.unshift({ tok: bounds[f[0]].i + 1, start: G[f[2]][1], prevEnd: G[f[2]][0] });
    [i, j] = f;
  }
  // segments between anchors
  const times = new Array(toks.length);
  let segTok = 0;
  let segStart = sm.on;
  for (const a of [...anchors, { tok: toks.length, start: sm.off, prevEnd: sm.off }]) {
    const t = spread(weights, segTok, a.tok, segStart, a.prevEnd, G);
    t.forEach((v, idx) => (times[segTok + idx] = v));
    segTok = a.tok;
    segStart = a.start;
  }
  return times.map((t) => +Math.max(0, t - 0.03).toFixed(3)); // reveal just as each word begins
}

// ---------- run ----------
const tmpPage = path.join(WORK, 'vo_encoder.html');
fs.writeFileSync(tmpPage, PAGE);
const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new' });
const page = await browser.newPage();
await page.goto(pathToFileURL(tmpPage).href);
const meta = {};
for (const id of available) {
  const b64 = fs.readFileSync(path.join(MP3DIR, `${id}.mp3`)).toString('base64');
  const res = await page.evaluate((b) => window.processClip(b), b64);
  fs.writeFileSync(path.join(OUTDIR, `${id}.ogg`), muxOggOpus(res));
  meta[id] = { duration: res.duration, sm: speechMap(res.env) };
}
await browser.close();
fs.rmSync(tmpPage, { force: true });

const lines = {};
const missing = [];
const pace = [];
for (const e of script) {
  const m = meta[e.clip];
  if (!m) {
    missing.push(e.id);
    continue;
  }
  lines[e.line] = [e.clip, +m.duration.toFixed(3), wordTimes(e.line, m.sm), +m.sm.off.toFixed(3)];
  const cps = e.spoken.length / m.duration;
  if (e.clip === e.id && (cps < 6 || cps > 22)) pace.push(`${e.id} ${cps.toFixed(1)} chars/s`);
}
// remove clips no line uses
for (const f of fs.readdirSync(OUTDIR)) if (!clipIds.includes(f.replace(/\.ogg$/, ''))) fs.rmSync(path.join(OUTDIR, f));

const header = `// GENERATED by tools/vo_build.mjs from tools/vo_script.json. Do not edit by hand.
// line (exactly as displayed, parts joined by "\\n") -> [clip id, seconds, word reveal times (s) per displayed word, speech end (s)]
`;
fs.writeFileSync('src/vo_lines.js', `${header}export const VO_LINES = ${JSON.stringify(lines, null, 1)};\n`);
const bytes = fs.readdirSync(OUTDIR).reduce((s, f) => s + fs.statSync(path.join(OUTDIR, f)).size, 0);
const secs = Object.values(meta).reduce((s, m) => s + m.duration, 0);
console.log(`clips: ${Object.keys(meta).length}/${clipIds.length} | lines mapped: ${Object.keys(lines).length}/${script.length} | audio ${(secs / 60).toFixed(2)} min | assets/vo ${(bytes / 1024).toFixed(0)} KB`);
if (missing.length) console.log('lines without a clip yet:', missing.join(', '));
if (pace.length) console.log('pace outliers (listen to these):', pace.join('; '));
fs.writeFileSync(path.join(WORK, 'build_meta.json'), JSON.stringify(meta, null, 1));
