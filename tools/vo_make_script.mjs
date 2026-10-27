// Builds tools/vo_script.json from the game's narration copy table (src/data/narration.js).
// Keeps existing ids/spoken forms for lines that already exist, so re-running is safe.
//   node tools/vo_make_script.mjs
//
// Spoken-form rules (the panel keeps the written form):
//   digits -> English words (the studio's script step would otherwise translate them to Hindi)
//   90° -> "ninety degrees", < / > / = -> "less than" / "greater than" / "equals"
//   " · " and line breaks -> sentence pauses; ALL-CAPS titles -> sentence case

import fs from 'node:fs';
import { narrationLines } from '../src/data/narration.js';

const OUT = 'tools/vo_script.json';
const NUM = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 90: 'ninety' };

// hand-tuned spoken forms (checked after the pilot)
const OVERRIDES = {};

export function spokenForm(parts) {
  return parts
    .map((p) => {
      let s = p;
      if (s === s.toUpperCase() && /[A-Z]/.test(s)) s = s.charAt(0) + s.slice(1).toLowerCase();
      s = s.replace(/\s*·\s*/g, ', ');
      s = s.replace(/<\s*(\d+)°/g, 'less than $1°').replace(/>\s*(\d+)°/g, 'greater than $1°').replace(/=\s*(\d+)°/g, 'equals $1°');
      s = s.replace(/(\d+)° angle/g, (_, n) => `${NUM[n] ?? n}-degree angle`);
      s = s.replace(/(\d+)°/g, (_, n) => `${NUM[n] ?? n} degrees`);
      s = s.replace(/\b(\d+)\b/g, (_, n) => NUM[n] ?? n);
      s = s.trim();
      if (!/[.?!]$/.test(s)) s += '.';
      return s;
    })
    .join(' ');
}

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const byLine = new Map(prev.map((e) => [e.line, e]));
let next = prev.reduce((m, e) => Math.max(m, +e.id.slice(2)), 0) + 1;
const script = narrationLines().map((l) => {
  const old = byLine.get(l.key);
  const id = old?.id ?? `vo${String(next++).padStart(3, '0')}`;
  return { id, line: l.key, spoken: OVERRIDES[l.key] ?? l.spoken ?? old?.spoken ?? spokenForm(l.parts), context: l.context };
});
// lines that are spoken identically share one clip (e.g. 'ISOSCELES' tag and 'Isosceles' report row)
for (const e of script) e.clip = script.find((o) => o.spoken.toLowerCase() === e.spoken.toLowerCase()).id;
fs.writeFileSync(OUT, JSON.stringify(script, null, 2) + '\n');
console.log(`${script.length} lines -> ${OUT}`);
for (const e of script) console.log(`${e.id} | ${e.line.replace(/\n/g, ' / ')}${e.spoken !== e.line ? `  =>  ${e.spoken}` : ''}`);
