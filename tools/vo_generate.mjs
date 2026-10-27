// Drives the "Ai Wala Human By Aamir" TTS studio (Batch Generation) for a chunk of clips.
//   node tools/vo_generate.mjs --ids vo001,vo002 [--out <dir>]     generate those clips
//   node tools/vo_generate.mjs --next 3 [--out <dir>]              next N clips without an MP3 yet
//   node tools/vo_generate.mjs --inspect                           upload a file, list controls, generate nothing
//
// The page's service worker is bypassed; every generativelanguage.googleapis.com request is
// re-sent to the studio's own proxy (what the service worker would have done). Every response
// is logged; the script-step text (Devanagari) is kept for the Devanagari check.
// The studio allows 100 requests / 15 min per IP; each row costs 2. Never exceed it.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { writeXlsx, readZip } from './vo_zip.mjs';

export const STUDIO = 'https://ai-wala-human-by-aamir-809572708022.asia-southeast1.run.app/';
const SETTINGS = { language: 'hi', format: 'mp3', voice: 'Female Teacher (Standard)', concurrency: '3' };
const BROWSER = process.env.QA_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] ?? true : null;
};
const OUT = path.resolve(opt('--out') || process.env.VO_WORK || 'vo-work');
fs.mkdirSync(path.join(OUT, 'mp3'), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export async function quota() {
  const r = await fetch(STUDIO + 'gemini-api-proxy/v1beta/models?__applet_proxy=true');
  return { status: r.status, limit: +r.headers.get('ratelimit-limit'), remaining: +r.headers.get('ratelimit-remaining'), reset: +r.headers.get('ratelimit-reset') };
}

function pickRows() {
  const script = JSON.parse(fs.readFileSync('tools/vo_script.json', 'utf8'));
  const clips = script.filter((e) => e.clip === e.id);
  if (opt('--ids')) {
    const ids = String(opt('--ids')).split(',');
    return clips.filter((e) => ids.includes(e.id));
  }
  const n = +(opt('--next') || 0);
  return clips.filter((e) => !fs.existsSync(path.join(OUT, 'mp3', `${e.id}.mp3`))).slice(0, n);
}

async function setSelectByOption(page, matcher) {
  return page.evaluate((m) => {
    for (const s of document.querySelectorAll('select')) {
      const o = [...s.options].find((o) => (m.value && o.value === m.value) || (m.text && o.text.trim().toLowerCase().startsWith(m.text.toLowerCase())));
      if (o && (!m.only || [...s.options].some((x) => new RegExp(m.only, 'i').test(x.text)))) {
        s.value = o.value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return `${o.value}=${o.text}`;
      }
    }
    return null;
  }, matcher);
}

async function setInputNear(page, labelRe, value) {
  return page.evaluate(
    (re, v) => {
      const rx = new RegExp(re, 'i');
      for (const lab of document.querySelectorAll('label, span, p, div')) {
        if (lab.children.length > 2 || !rx.test(lab.textContent.trim()) || lab.textContent.trim().length > 40) continue;
        const scope = lab.closest('div');
        const el = scope?.querySelector('input:not([type=file]), select');
        if (!el) continue;
        const setter = Object.getOwnPropertyDescriptor(el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set;
        if (el.tagName === 'SELECT') {
          const o = [...el.options].find((o) => o.value === v || o.text.trim() === v);
          if (!o) continue;
          setter.call(el, o.value);
        } else setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return `${lab.textContent.trim()} -> ${el.value}`;
      }
      return null;
    },
    labelRe.source ?? labelRe,
    String(value),
  );
}

const describe = (page) =>
  page.evaluate(() => ({
    selects: [...document.querySelectorAll('select')].map((s) => ({ value: s.value, options: [...s.options].map((o) => `${o.value}=${o.text.trim()}`) })),
    inputs: [...document.querySelectorAll('input')].map((i) => ({ type: i.type, value: i.value, label: (i.closest('div')?.innerText || '').trim().slice(0, 40) })),
    buttons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean),
  }));

async function run() {
  const rows = opt('--inspect') ? [{ id: 'vo000', spoken: 'Test.' }] : pickRows();
  if (!rows.length) return log('nothing to generate');
  if (!opt('--inspect')) {
    const q = await quota();
    log(`quota: ${q.remaining}/${q.limit}, resets in ${q.reset}s`);
    if (q.remaining < rows.length * 2 + 2) throw new Error(`not enough quota for ${rows.length} rows (needs ${rows.length * 2 + 2}); wait ${q.reset}s`);
  }
  const stamp = Date.now();
  const xlsxPath = path.join(OUT, `batch_${stamp}.xlsx`);
  fs.writeFileSync(xlsxPath, writeXlsx([['filename', 'text'], ...rows.map((r) => [r.id, r.spoken])]));
  log(`${rows.length} rows -> ${xlsxPath}`);

  const browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new' });
  const page = await browser.newPage();
  await page.setBypassServiceWorker(true);
  const cdp = await page.createCDPSession();
  const dl = path.join(OUT, `dl_${stamp}`);
  fs.mkdirSync(dl, { recursive: true });
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, eventsEnabled: true });

  const netlog = [];
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    const url = req.url();
    if (!url.startsWith('https://generativelanguage.googleapis.com/')) return req.continue();
    // CORS preflight: answer locally. Forwarding it would cost rate-limit quota for nothing.
    if (req.method() === 'OPTIONS') {
      return req.respond({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*',
          'access-control-max-age': '600',
        },
        body: '',
      });
    }
    const rest = url.slice('https://generativelanguage.googleapis.com/'.length);
    const proxied = `${STUDIO}gemini-api-proxy/${rest}${rest.includes('?') ? '&' : '?'}__applet_proxy=true`;
    const h = req.headers();
    const headers = {};
    for (const k of ['content-type', 'accept']) if (h[k]) headers[k] = h[k];
    try {
      const r = await fetch(proxied, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      const body = Buffer.from(await r.arrayBuffer());
      const entry = { t: Date.now(), path: rest.split('?')[0], status: r.status, remaining: r.headers.get('ratelimit-remaining') };
      const isTts = /tts/i.test(rest);
      if (!isTts && r.status === 200) {
        try {
          entry.script = JSON.parse(body.toString()).candidates?.[0]?.content?.parts?.[0]?.text;
          entry.request = JSON.parse(req.postData() || '{}').contents?.[0]?.parts?.[0]?.text;
        } catch {}
      }
      if (r.status !== 200) entry.body = body.toString().slice(0, 600);
      netlog.push(entry);
      log(`${req.method()} ${entry.path} -> ${r.status} (remaining ${entry.remaining})`);
      await req.respond({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' }, body });
    } catch (e) {
      netlog.push({ t: Date.now(), path: rest, error: String(e) });
      req.abort();
    }
  });

  await page.goto(STUDIO, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Batch Generation$/i.test(b.innerText.trim()))?.click());
  await sleep(800);
  const input = await page.$('input[type=file]');
  await input.uploadFile(xlsxPath);
  await sleep(2500);
  if (opt('--inspect')) {
    console.log(JSON.stringify(await describe(page), null, 1));
    await browser.close();
    return;
  }

  const set = [];
  set.push(await setSelectByOption(page, { value: SETTINGS.language, only: 'Hindi' }));
  set.push(await setSelectByOption(page, { value: SETTINGS.format, only: 'MP3' }));
  set.push(await setSelectByOption(page, { text: SETTINGS.voice }));
  set.push(await setSelectByOption(page, { text: SETTINGS.concurrency, only: 'Recommended' }));
  set.push(await setInputNear(page, /^Text Column/, 'text'));
  set.push(await setInputNear(page, /^Filename Column/, 'filename'));
  set.push(await setInputNear(page, /^Start Row/, 1));
  set.push(await setInputNear(page, /^Quantity/, rows.length));
  log('settings:', JSON.stringify(set));
  if (set.some((x) => !x)) {
    console.log(JSON.stringify(await describe(page), null, 1));
    throw new Error('could not set every control; see the dump above');
  }
  await sleep(500);
  const label = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).find((t) => t.startsWith('GENERATE (')));
  if (label !== `GENERATE (${rows.length})`) throw new Error(`unexpected generate label: ${label}`);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('GENERATE (')).click());
  log('generating...');

  for (let attempt = 0; ; attempt++) {
    await sleep(3000);
    let busy = true;
    while (busy) {
      busy = await page.evaluate(() => document.body.innerText.includes('Processing...'));
      if (busy) await sleep(3000);
    }
    // count row status badges whose whole text is "Failed" (not words elsewhere on the page)
    const failed = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && el.textContent.trim() === 'Failed').length);
    const done = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && el.textContent.trim() === 'Done').length);
    log(`rows: ${done} done, ${failed} failed`);
    if (!failed || done >= rows.length || attempt >= 3) break;
    const q = await quota();
    if (q.remaining < failed * 2 + 2) {
      log(`${failed} failed, not enough quota to retry (${q.remaining} left)`);
      break;
    }
    log(`${failed} failed; retrying (${attempt + 1}/3)`);
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((b) => /retry/i.test(b.innerText));
      b?.click();
      return !!b;
    });
    if (!clicked) break;
  }

  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /DOWNLOAD ALL/i.test(b.innerText))?.click());
  let zipFile = null;
  for (let i = 0; i < 60 && !zipFile; i++) {
    await sleep(1000);
    zipFile = fs.readdirSync(dl).find((f) => f.endsWith('.zip'));
  }
  fs.writeFileSync(path.join(OUT, `log_${stamp}.json`), JSON.stringify(netlog, null, 2));
  if (!zipFile) throw new Error('no zip downloaded');
  const zipPath = path.join(OUT, `voiceovers_batch_${stamp}.zip`);
  fs.renameSync(path.join(dl, zipFile), zipPath);
  let n = 0;
  for (const e of readZip(fs.readFileSync(zipPath))) {
    const m = e.name.match(/(vo\d+)\.mp3$/);
    if (m && e.data.length) {
      fs.writeFileSync(path.join(OUT, 'mp3', `${m[1]}.mp3`), e.data);
      n++;
    }
  }
  rebuildDevanagari();
  log(`done: ${n}/${rows.length} MP3s saved to ${path.join(OUT, 'mp3')}; zip ${zipPath}`);
  await browser.close();
}

if (process.argv[1].endsWith('vo_generate.mjs')) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

/** Devanagari per clip, rebuilt from every saved log: script-step responses matched to rows by request text. */
export function rebuildDevanagari(out = OUT) {
  const script = JSON.parse(fs.readFileSync('tools/vo_script.json', 'utf8'));
  const logs = fs.readdirSync(out).filter((f) => /^log_\d+\.json$/.test(f)).sort();
  const dev = {};
  for (const f of logs) {
    for (const x of JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'))) {
      if (!x.script || !x.request) continue;
      // longest match wins: one spoken form can be a prefix of another ("... six metres." / "... six metres. It is equilateral.")
      const row = script.filter((e) => e.clip === e.id && x.request.includes(e.spoken)).sort((a, b) => b.spoken.length - a.spoken.length)[0];
      if (row) dev[row.id] = x.script.trim(); // later logs (regenerations) win
    }
  }
  fs.writeFileSync(path.join(out, 'devanagari.json'), JSON.stringify(dev, null, 2));
  return dev;
}
if (opt('--devanagari')) console.log(rebuildDevanagari());
