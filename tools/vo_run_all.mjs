// Generates every clip that has no MP3 yet, in rate-limit-sized chunks.
//   node tools/vo_run_all.mjs   (uses VO_WORK as the work dir)
// Chunk = floor(remaining / 2) - 1 rows (max 48); waits ratelimit-reset + 30 s between windows.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { quota } from './vo_generate.mjs';

const OUT = path.resolve(process.env.VO_WORK || 'vo-work');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pending = () => {
  const script = JSON.parse(fs.readFileSync('tools/vo_script.json', 'utf8'));
  return script.filter((e) => e.clip === e.id && !fs.existsSync(path.join(OUT, 'mp3', `${e.id}.mp3`)));
};

for (let round = 0; round < 12; round++) {
  const left = pending();
  if (!left.length) {
    log('all clips generated');
    process.exit(0);
  }
  const q = await quota();
  const n = Math.min(48, Math.floor(q.remaining / 2) - 1, left.length);
  log(`${left.length} clips left; quota ${q.remaining}/${q.limit}, reset ${q.reset}s -> chunk ${n}`);
  if (n < 1) {
    log(`waiting ${q.reset + 30}s for the rate-limit window`);
    await sleep((q.reset + 30) * 1000);
    continue;
  }
  try {
    execFileSync(process.execPath, ['tools/vo_generate.mjs', '--next', String(n)], { stdio: 'inherit', env: process.env });
  } catch (e) {
    log('chunk failed:', e.message);
  }
  const after = await quota();
  if (pending().length) {
    log(`waiting ${after.reset + 30}s before the next chunk`);
    await sleep((after.reset + 30) * 1000);
  }
}
log('stopped: some clips still missing', pending().map((e) => e.id).join(','));
process.exit(1);
