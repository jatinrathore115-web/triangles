// Voice-over QA at normal speed with real mouse input:
//   intro briefing (unskipped) -> mission 1: wrong answer (hint) -> right answer (reinforcement)
// Samples the voice element + revealed words every 100 ms and checks, for every voiced line:
//   - audio really plays (currentTime advances, element not paused)
//   - revealed words == words spoken so far (within 1 word) at every sample
//   - the last word is revealed before the voice ends, and the text completes with the voice
//   - CONTINUE is only enabled after the reinforcement voice has finished
//   - every shown line has a clip
// Usage: node scripts/vo-qa.mjs [url]   (default: dist/BridgeEngineer.html)

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const URL = process.argv[2] || pathToFileURL(path.resolve('dist/BridgeEngineer.html')).href;
const BROWSER = process.env.QA_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const b = await puppeteer.launch({ executablePath: BROWSER, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
await p.setViewport({ width: 1600, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('framenavigated', (f) => f === p.mainFrame() && console.log('navigated:', f.url()));
const k = 1600 / 1920;
const click = async (x, y) => {
  await p.mouse.move(x * k, y * k, { steps: 4 });
  await p.mouse.down();
  await sleep(50);
  await p.mouse.up();
};

await p.goto(URL, { waitUntil: 'load' });
await p.waitForFunction(() => window.__bridge?.phase === 'intro' && window.__vo, { timeout: 30000 });
// sampler: one record per 100 ms while a line is being narrated
await p.evaluate(() => {
  window.__voLog = [];
  setInterval(() => {
    const { Narrator, voice, VO_LINES } = window.__vo;
    const job = Narrator.active;
    if (!job) return;
    const e = VO_LINES[job.wt.key];
    window.__voLog.push({
      key: job.wt.key,
      t: voice.el.currentTime,
      paused: voice.el.paused,
      ended: voice.el.ended,
      src: voice.el.src.split('/').pop(),
      revealed: job.wt.revealed,
      expected: e ? e[2].filter((x) => x <= voice.el.currentTime).length : null,
      // words due one sampling window ago: the game reveals on its next frame, so a token that
      // shares its time with the next one (e.g. "·") may land a frame later
      expectedLag: e ? e[2].filter((x) => x <= voice.el.currentTime - 0.12).length : null,
      n: job.wt.words.length,
      audio: job.audio,
      now: performance.now(),
    });
  }, 100);
});
await sleep(800);
await click(960 - 530 + 1060 - 210, 540 - 300 + 490); // BEGIN
await p.waitForFunction(() => window.__bridge.scene.introPhase === 'ready', { timeout: 90000 });
await sleep(500);
await p.waitForFunction(() => !window.__vo.Narrator.active, { timeout: 15000 }).catch(() => {});
await p.screenshot({ path: 'qa-shots/vo-1-intro-done.png' });
await click(960 - 530 + 1060 - 210, 540 - 300 + 490); // START BUILDING
await p.waitForFunction(() => window.__bridge.phase === 'mission' && window.__bridge.placement.state === 'idle', { timeout: 20000 });
await sleep(1500);
await p.screenshot({ path: 'qa-shots/vo-2-instruction-mid.png' });
await p.waitForFunction(() => !window.__vo.Narrator.active, { timeout: 15000 });

// wrong answer -> "Not quite." + what that frame is, then (after a beat) the hint
let st = await p.evaluate(() => ({ zones: window.__bridge.frameZones(), correct: window.__bridge.correctIndex(), btn: window.__bridge.controlsButton() }));
const wrong = [0, 1, 2].find((i) => i !== st.correct);
await click(st.zones[wrong].x, st.zones[wrong].y);
await sleep(500);
await click(st.btn.x, st.btn.y);
await p.waitForFunction(() => window.__vo.Narrator.active?.wt.key.startsWith('Not quite.'), { timeout: 30000 });
await sleep(1200);
await p.screenshot({ path: 'qa-shots/vo-3-wrong-mid.png' });
const hint1 = await p.evaluate(() => window.__bridge.mission.hints[0]);
await p.waitForFunction((h) => window.__vo.Narrator.active?.wt.key === h, { timeout: 30000 }, hint1);
await sleep(800);
await p.screenshot({ path: 'qa-shots/vo-3-hint-mid.png' });
await p.waitForFunction(() => window.__bridge.placement.state === 'idle' && !window.__vo.Narrator.active, { timeout: 30000 });
{
  // order of what was said: the diagnosis finishes before the hint starts, never over it
  const keys = await p.evaluate(() => [...new Set(window.__voLog.map((r) => r.key))]);
  const di = keys.findIndex((k) => k.startsWith('Not quite.'));
  check('wrong pick: diagnosis spoken, then the hint', di >= 0 && keys[di + 1] === hint1, keys.slice(-3).join(' | '));
}

// right answer -> reinforcement narration; CONTINUE must wait for the voice
await click(st.zones[st.correct].x, st.zones[st.correct].y);
await sleep(500);
await click(st.btn.x, st.btn.y);
await p.waitForFunction(() => window.__vo.Narrator.active?.wt.key.includes('Isosceles Triangle'), { timeout: 40000 });
await sleep(1500);
await p.screenshot({ path: 'qa-shots/vo-4-reinforcement-mid.png' });
const atContinue = await p.evaluate(
  () =>
    new Promise((res) => {
      const t = setInterval(() => {
        const c = window.__bridge.scene.controls;
        if (c.mode === 'next' && c.enabled) {
          clearInterval(t);
          res({ ended: window.__vo.voice.el.ended, paused: window.__vo.voice.el.paused, active: !!window.__vo.Narrator.active });
        }
      }, 50);
    }),
);
check('CONTINUE appears only after the reinforcement voice finished', atContinue.ended || (atContinue.paused && !atContinue.active), JSON.stringify(atContinue));

// ---------- analyse ----------
const log = await p.evaluate(() => window.__voLog);
const stats = await p.evaluate(() => ({ voiced: window.__vo.Narrator.stats.voiced, silent: window.__vo.Narrator.stats.silent, missing: [...window.__vo.Narrator.stats.missing], shown: window.__vo.Narrator.stats.shown }));
const byLine = new Map();
for (const r of log) {
  if (!byLine.has(r.key)) byLine.set(r.key, []);
  byLine.get(r.key).push(r);
}
const VO = await p.evaluate(() => window.__vo.VO_LINES);
for (const [key, rows] of byLine) {
  const label = key.replace(/\n/g, ' / ').slice(0, 60);
  const e = VO[key];
  if (!e) continue;
  const playing = rows.filter((r) => r.audio && !r.paused);
  const maxT = Math.max(...rows.map((r) => r.t));
  const audioOk = playing.length >= 3 && maxT > 0.5;
  // sync: while the audio is playing, revealed words track the spoken ones (±1)
  const off = playing.filter((r) => r.revealed < r.expectedLag - 1 || r.revealed > r.expected + 1);
  const last = rows[rows.length - 1];
  const fullBeforeEnd = rows.find((r) => r.revealed >= r.n);
  check(`"${label}": audio plays (${maxT.toFixed(1)}s of ${e[1]}s)`, audioOk);
  check(`"${label}": words in sync with voice`, off.length === 0, off.length ? `${off.length} samples off, e.g. t=${off[0].t.toFixed(2)} revealed ${off[0].revealed} expected ${off[0].expected}` : `${playing.length} samples`);
  check(`"${label}": text and voice finish together`, !!fullBeforeEnd && fullBeforeEnd.t <= e[1] + 0.05 && last.revealed >= last.n - 1, fullBeforeEnd ? `all words shown at ${fullBeforeEnd.t.toFixed(2)}s, clip ${e[1]}s` : 'never fully revealed');
}
const unexpectedMissing = stats.missing;
check('every shown line has a clip', unexpectedMissing.length === 0, unexpectedMissing.join(' | '));
check('no page errors', errs.length === 0, errs.join(' | '));
console.log(`voiced lines: ${stats.voiced}, silent: ${stats.silent}`);
await b.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} voice checks passed`);
process.exit(failed ? 1 : 0);
