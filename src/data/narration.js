// Narration copy table: the single source of truth for every line the game voices.
// UI code displays these exact strings, and tools/vo_make_script.mjs builds the voice-over
// script from narrationLines(), so the text on screen always matches its clip.
//
// A line can have several parts (e.g. title + body). Its key is parts.join('\n').

import { MISSIONS, STAGES } from './missions.js';
import { TRIANGLE_FRAMES, TRIANGLE_TYPES, framePoints } from './triangleFrames.js';
import { classify, formatLength } from '../utils/geometry.js';

export const COPY = {
  introStory: ['Sunnyside and Riverdale sit on opposite banks of the river.', 'Choose the right triangular frames and build the bridge that connects them.'],
  introSteps: [
    ['Select a frame', 'Read its markings'],
    ['Place it with the crane', 'The bridge tests the fit'],
    ['Complete all 6 stages', 'Then test your bridge'],
  ],
  nudge: 'Click a frame to select it',
  stage2Subtitle: 'Now classify triangles by their angles',
  finalAssembly: ['FINAL ASSEMBLY', 'All six structural stages installed'],
  bridgeComplete: ['BRIDGE COMPLETE', 'Structure verified · ready for the load test'],
  loadTestCrossing: 'Vehicle crossing · deflection within limits',
  loadTestPassed: 'The bridge carried the load safely',
  reportTitle: 'STRUCTURAL REPORT',
};

export const REPORT_ORDER = ['isosceles', 'equilateral', 'scalene', 'acute', 'right', 'obtuse'];

// ---------------------------------------------------------------------------------------------
// Answer feedback. Each line is built ONCE from a template and rendered twice: with the display
// formatter (what the panel shows: "8 m", "90°", "3") and with the spoken formatter (what the
// voice says: "eight metres", "ninety degrees", "three"). Numbers come from the frame geometry,
// rounded exactly like the frame's own stamped labels, so the explanation matches the picture.

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
/** English number words (the TTS script step would otherwise translate digits into Hindi). */
export function numberWords(x) {
  if (!Number.isInteger(x)) {
    const [i, d] = String(x).split('.');
    return `${numberWords(+i)} point ${[...d].map((c) => ONES[+c]).join(' ')}`;
  }
  if (x < 20) return ONES[x];
  if (x < 100) return TENS[Math.floor(x / 10)] + (x % 10 ? `-${ONES[x % 10]}` : '');
  const h = `${ONES[Math.floor(x / 100)]} hundred`;
  return x % 100 ? `${h} and ${numberWords(x % 100)}` : h;
}

const round1 = (m) => Math.round(m * 10) / 10;
const SHOW = { n: String, len: formatLength, deg: (d) => `${d}°` };
export const SAY = { n: numberWords, len: (m) => `${numberWords(round1(m))} metres`, deg: (d) => `${numberWords(d)} degrees` };
/** Spoken form of a short fixed rule ("All 3 angles are less than 90°."). */
const sayRule = (s) => s.replace(/(\d+)°/g, (_, d) => SAY.deg(+d)).replace(/\d+/g, (d) => numberWords(+d));

/** Readings of a frame, rounded the way its stamped labels show them. */
export function frameFacts(frameId) {
  const c = classify(framePoints(TRIANGLE_FRAMES[frameId]));
  const sides = c.edges.map((e) => round1(e.length)).sort((a, b) => a - b);
  const angles = c.angleDegrees.map(Math.round).sort((a, b) => a - b);
  return { sides, angles, bySides: c.sides, byAngles: c.angles, largest: angles[2] };
}

const missionIndex = (mission) => MISSIONS.findIndex((m) => m.id === mission.id);
/** A type is named in feedback only once its own mission has taught it. */
const taught = (type, mission) => MISSIONS.findIndex((m) => m.target.type === type) < missionIndex(mission);
const typeOf = (mission, frameId) => frameFacts(frameId)[mission.target.by === 'sides' ? 'bySides' : 'byAngles'];
/** "6 m, 9 m and 10 m" */
const listOf = (vals, fmt) => `${vals.slice(0, -1).map(fmt).join(', ')} and ${fmt(vals[vals.length - 1])}`;

/** The single fact that decides a frame's type: the thing the learner should have read. */
function frameFact(frameId, by, f, subject) {
  const x = frameFacts(frameId);
  if (by === 'sides') {
    const [a, b, c] = x.sides;
    if (x.bySides === 'equilateral') return `All ${f.n(3)} sides of ${subject} are ${f.len(a)}.`;
    if (x.bySides === 'isosceles') return a === b ? `Two sides are ${f.len(a)} and one is ${f.len(c)}.` : `Two sides are ${f.len(c)} and one is ${f.len(a)}.`;
    return `Its sides are ${listOf([a, b, c], f.len)}. None match.`;
  }
  if (x.byAngles === 'right') return `Its largest angle is exactly ${f.deg(90)}.`;
  if (x.byAngles === 'obtuse') return `Its largest angle is ${f.deg(x.largest)}, more than ${f.deg(90)}.`;
  return `Its largest angle is ${f.deg(x.largest)}, less than ${f.deg(90)}.`;
}

export const WRONG_LEAD = 'Not quite.';

/** Wrong pick: what the chosen frame actually is. Never names or points at the right answer. */
export function wrongLine(mission, frameId, f = SHOW) {
  const type = typeOf(mission, frameId);
  let s = `${WRONG_LEAD} ${frameFact(frameId, mission.target.by, f, 'that frame')}`;
  if (taught(type, mission)) s += type === 'right' ? ' It is a right triangle.' : ` It is ${TRIANGLE_TYPES[type].short.toLowerCase()}.`;
  return s;
}

/** Marking to pulse on the rejected frame while its fact is being spoken. */
export function wrongHighlight(mission, frameId) {
  if (mission.target.by === 'angles') return 'largestAngle';
  return frameFacts(frameId).bySides === 'scalene' ? 'allSides' : 'equalSides';
}

const PRAISE = ['PERFECT FIT', 'SPOT ON', 'WELL DONE', 'GREAT READING', 'EXACTLY RIGHT', 'BRILLIANT'];

/**
 * Right pick: praise + bridge progress, the type, its rule, and why THIS frame qualifies.
 * Returns the displayed card parts and the matching spoken form.
 */
export function correctCard(mission, frameId) {
  const i = missionIndex(mission);
  const x = frameFacts(frameId);
  const why = (f) => {
    if (mission.target.by === 'sides') return frameFact(frameId, 'sides', f, 'this frame');
    if (x.byAngles === 'acute') return `Its angles are ${listOf(x.angles, f.deg)}.`;
    if (x.byAngles === 'right') return f === SAY ? 'The square mark shows its ninety-degree corner.' : 'The square mark shows its 90° corner.';
    return `Its largest angle is ${f.deg(x.largest)}.`;
  };
  const praise = PRAISE[i % PRAISE.length];
  const { title, body } = mission.reinforcement;
  const kicker = `${praise} · SECTION ${i + 1} OF ${MISSIONS.length}`;
  const spokenKicker = `${praise.charAt(0)}${praise.slice(1).toLowerCase()}! Section ${numberWords(i + 1)} of ${numberWords(MISSIONS.length)}.`;
  return {
    kicker,
    title,
    body,
    why: why(SHOW),
    highlight: mission.reinforcement.highlight,
    spoken: `${spokenKicker} ${title}. ${sayRule(body)} ${why(SAY)}`,
  };
}

/** The frame that answers a mission (exactly one; npm run validate checks it). */
export const answerFrame = (mission) => mission.options.find((id) => typeOf(mission, id) === mission.target.type);

export const lineKey =(parts) => (Array.isArray(parts) ? parts.join('\n') : parts);

/** Every voiced line, in the order a learner first hears it. */
export function narrationLines() {
  const out = [];
  // spoken: the exact words the voice says, when the line generates them alongside its text
  const add = (parts, context, spoken) => {
    const p = Array.isArray(parts) ? parts : [parts];
    const key = lineKey(p);
    if (!out.some((l) => l.key === key)) out.push({ key, parts: p, context, spoken });
  };
  COPY.introStory.forEach((l, i) => add(l, `intro story ${i + 1}`));
  COPY.introSteps.forEach((s, i) => add(s, `intro step ${i + 1}`));
  MISSIONS.forEach((m, mi) => {
    add(m.instruction, `${m.id} instruction`);
    if (mi === 0) add(COPY.nudge, 'idle nudge');
    m.options
      .filter((id) => id !== answerFrame(m))
      .forEach((id) => add(wrongLine(m, id), `${m.id} wrong pick ${id}`, wrongLine(m, id, SAY)));
    m.hints.forEach((h, hi) => add(h, `${m.id} hint ${hi + 1}`));
    const card = correctCard(m, answerFrame(m));
    add([card.kicker, card.title, card.body, card.why], `${m.id} correct`, card.spoken);
    if (m.checkpoint) {
      const cp = m.checkpoint;
      add([cp.title, cp.subtitle], 'checkpoint banner');
      cp.items.forEach((it) => add([TRIANGLE_TYPES[it.stage].short.toUpperCase(), TRIANGLE_TYPES[it.stage].spec], `checkpoint tag ${it.stage}`));
      if (cp.next) add([cp.next, COPY.stage2Subtitle], 'stage 2 banner');
    }
  });
  add(COPY.finalAssembly, 'finale banner');
  add(COPY.bridgeComplete, 'complete banner');
  add(COPY.loadTestCrossing, 'load test');
  add(COPY.loadTestPassed, 'load test passed');
  add(COPY.reportTitle, 'report title');
  REPORT_ORDER.forEach((t) => add([TRIANGLE_TYPES[t].short, TRIANGLE_TYPES[t].spec], `report ${t}`));
  return out;
}

export { STAGES };
