// End-to-end QA for the full game. Drives the real build in headless Edge/Chrome with mouse
// clicks mapped from 1920x1080 game coordinates and screenshots every beat.
// Usage: start `npm run dev` first, then `npm run qa` (writes to ./qa-shots).
//
// Covers: intro, all 6 missions, every distractor, repeated wrong attempts, hint escalation
// to level 3, keyboard confirm, progress persistence, stage checkpoint, final construction,
// bridge test, structural report (+ view bridge toggle), replay/reset, first-try scoring,
// letterboxed aspect ratios, console errors.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.env.QA_URL ?? 'http://localhost:5199/';
const OUT = process.env.QA_OUT ?? 'qa-shots';
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
];
const executablePath = process.env.QA_BROWSER ?? BROWSERS.find((p) => fs.existsSync(p));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const VW = 1600;
const VH = 900;
const k = VW / 1920;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await puppeteer.launch({ executablePath, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: VW, height: VH });
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const click = async (x, y) => {
  await page.mouse.move(x * k, y * k, { steps: 4 });
  await sleep(60);
  await page.mouse.down();
  await sleep(40);
  await page.mouse.up();
};
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const S = () =>
  page.evaluate(() => {
    const b = window.__bridge;
    const sc = b.scene;
    return {
      phase: b.phase,
      state: b.placement.state,
      mission: b.mission?.id,
      selected: sc.inventory?.selected,
      enabled: sc.inventory?.enabled,
      completed: b.missions.completedCount,
      progressText: sc.progress.count.text,
      controlsMode: sc.controls.mode,
      controlsEnabled: sc.controls.enabled,
      hintLevel: sc.hints.level,
      inYard: sc.inventory?.slots.map((s) => s.inYard) ?? [],
      homesOk: sc.inventory?.slots.every((s) => Math.abs(s.frame.x - s.home.x) < 1 && Math.abs(s.frame.rotation - s.restRot) < 0.01) ?? true,
      zones: b.frameZones(),
      correct: b.correctIndex(),
      button: b.controlsButton(),
      panels: sc.bridge.panels.size,
      score: b.scoring.total,
      stars: b.scoring.stars(6),
    };
  });
const waitFor = async (pred, timeout = 20000, label = 'state') => {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await S().catch(() => null);
    if (last && pred(last)) return last;
    await sleep(120);
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify(last)}`);
};
const ready = (id) => (x) => x.phase === 'mission' && x.state === 'idle' && x.enabled && (!id || x.mission === id);

async function attempt(idx, { keyboard = false } = {}) {
  let s = await S();
  await click(s.zones[idx].x, s.zones[idx].y);
  await sleep(450);
  s = await S();
  if (keyboard) await page.keyboard.press('Enter');
  else await click(s.button.x, s.button.y);
  return s;
}

const MISSIONS = ['m1-isosceles', 'm2-equilateral', 'm3-scalene', 'm4-acute', 'm5-right', 'm6-obtuse'];
const PANELS_AFTER = [2, 3, 5, 7, 9, 13];

await page.goto(URL, { waitUntil: 'load' });
// the standalone build boots slower than the dev server: wait for the intro, not a fixed delay
await waitFor((x) => x.phase === 'intro', 30000, 'intro');
await sleep(800);
await shot('00-intro');
await page.mouse.click(8, 8); // give the page keyboard focus (headless Chrome starts unfocused); lands on the intro scrim
await page.keyboard.press('Enter'); // BEGIN: unlocks the voice, the briefing is narrated
await sleep(3000);
await shot('00-intro-briefing');
// Enter during the briefing shows the line / skips it; after it, Enter = START BUILDING
for (let i = 0; i < 40; i++) {
  const ph = await page.evaluate(() => window.__bridge.phase);
  if (ph !== 'intro') break;
  await page.keyboard.press('Enter');
  await sleep(700);
}

let s;
for (let m = 0; m < MISSIONS.length; m++) {
  const id = MISSIONS[m];
  const tag = `${m + 1}-${id.split('-')[1]}`;
  s = await waitFor(ready(id), 30000, `mission ${id} ready`);
  await sleep(300);
  await shot(`${tag}-a-yard`);
  check(`${id}: progress before = ${m}/6`, s.completed === m && s.progressText === `${m} / 6`, s.progressText);
  check(`${id}: exactly one geometric answer`, s.correct >= 0);
  const distractors = [0, 1, 2].filter((i) => i !== s.correct);

  // every distractor, then a repeat on missions 1 and 4 to reach hint level 3
  const wrongs = m === 0 || m === 3 ? [...distractors, distractors[0]] : distractors;
  for (let w = 0; w < wrongs.length; w++) {
    await attempt(wrongs[w]);
    await sleep(1500);
    if (w === 0) await shot(`${tag}-b-reject`);
    s = await waitFor(ready(id), 20000, `${id} retry`);
    await sleep(900);
    check(`${id}: wrong #${w + 1} keeps progress`, s.completed === m, s.progressText);
    check(`${id}: hint level ${w + 1}`, s.hintLevel === Math.min(w + 1, 3), `level ${s.hintLevel}`);
    check(`${id}: rejected frame back home & upright`, s.inYard.every(Boolean) && s.homesOk);
    await shot(`${tag}-c-hint${w + 1}`);
  }

  // correct answer, confirmed with the keyboard on even missions
  await attempt(s.correct, { keyboard: m % 2 === 1 });
  await sleep(2600);
  await shot(`${tag}-d-installing`);
  if (m < 5) {
    s = await waitFor((x) => x.controlsMode === 'next' && x.controlsEnabled, 25000, `${id} complete`);
    await sleep(700);
    await shot(`${tag}-e-reinforcement`);
    check(`${id}: progress after = ${m + 1}/6`, s.completed === m + 1 && s.progressText === `${m + 1} / 6`, s.progressText);
    check(`${id}: stage panels assembled`, s.panels === PANELS_AFTER[m], `${s.panels} panels`);
    await click(s.button.x, s.button.y);
    if (m === 2) {
      await sleep(2300);
      await shot('3-checkpoint');
      s = await waitFor((x) => x.phase === 'checkpoint', 3000, 'checkpoint').catch(() => S());
      check('checkpoint runs after mission 3', s.phase === 'checkpoint' || s.mission === 'm4-acute');
    }
  }
}

// final construction + bridge test
s = await waitFor((x) => x.phase === 'finale', 30000, 'finale');
check('mission 6 complete: 6/6', s.completed === 6 && s.progressText === '6 / 6', s.progressText);
check('all 13 bridge panels installed', s.panels === 13, `${s.panels}`);
await sleep(2500);
await shot('7-a-final-assembly');
await sleep(4500);
await shot('7-b-details');
s = await waitFor((x) => x.phase === 'test', 30000, 'bridge test');
check('final construction sequence completes', true);
await sleep(3600);
await shot('7-c-vehicle-on-bridge');
await sleep(2600);
await shot('7-d-celebration');
s = await waitFor((x) => x.phase === 'report', 20000, 'report');
await sleep(1800);
await shot('8-a-structural-report');
check('bridge test executes and report appears', s.phase === 'report');
check('score + rating computed', s.score > 0 && s.stars >= 1, `${s.score} pts, ${s.stars} stars`);

// view bridge toggle and back
await click(70 + 1780 - 56 - 470, 44 + 992 - 62);
await sleep(700);
await shot('8-b-view-bridge');
await click(1920 - 200, 1080 - 60);
await sleep(700);

// replay / reset, then a first-try solve of mission 1
await click(70 + 1780 - 56 - 150, 44 + 992 - 62);
s = await waitFor(ready('m1-isosceles'), 20000, 'replay');
check('replay resets progress to 0/6', s.completed === 0 && s.progressText === '0 / 6' && s.panels === 0, `${s.progressText}, ${s.panels} panels`);
await attempt(s.correct);
s = await waitFor((x) => x.controlsMode === 'next' && x.controlsEnabled, 25000, 'first-try');
check('first-try answer earns full points (150)', s.score === 150, `${s.score}`);

for (const [w, h, n] of [
  [1280, 1024, '9-aspect-5x4'],
  [915, 412, '9-phone-landscape'],
  [1920, 820, '9-ultrawide'],
]) {
  await page.setViewport({ width: w, height: h });
  await sleep(500);
  await shot(n);
}

console.log('\nConsole errors/warnings:', errors.length ? '\n' + errors.join('\n') : 'none');
check('no runtime errors or warnings', errors.length === 0);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
