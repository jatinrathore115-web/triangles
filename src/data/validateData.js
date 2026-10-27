// Mathematical integrity checks for all game data. Runs at boot (dev console) and from
// `npm run validate`. A mission whose answer key disagrees with the geometry is a bug.

import { classify } from '../utils/geometry.js';
import { MISSIONS } from './missions.js';
import { TRIANGLE_FRAMES, REPORT_FRAMES, framePoints } from './triangleFrames.js';
import { PANELS, panelById, STAGE_SIDE_TYPES } from './bridgeLayout.js';

const sortedLengths = (c) => c.edges.map((e) => e.length.toFixed(2)).sort().join(',');

export function validateGameData() {
  const errors = [];
  const report = [];

  const checkFrame = (id) => {
    const def = TRIANGLE_FRAMES[id];
    if (!def) {
      errors.push(`unknown frame ${id}`);
      return null;
    }
    const c = classify(framePoints(def));
    // the rounded angle readings shown to players must tell the truth
    const shown = c.angleDegrees.map((a) => Math.round(a));
    if (c.angles !== 'right' && shown.includes(90)) errors.push(`${id}: a non-right angle would display as 90°`);
    if (c.angles === 'right' && !shown.includes(90)) errors.push(`${id}: right angle does not display as 90°`);
    if (c.angles === 'obtuse' && Math.max(...shown) <= 90) errors.push(`${id}: obtuse angle displays as ≤ 90°`);
    if (c.angles === 'acute' && Math.max(...shown) >= 90) errors.push(`${id}: acute frame displays an angle ≥ 90°`);
    if (shown.reduce((a, b) => a + b, 0) !== 180) {
      // rounding can drift by 1°; acceptable only if within 1
      if (Math.abs(shown.reduce((a, b) => a + b, 0) - 180) > 1) errors.push(`${id}: angle readings do not sum to 180°`);
    }
    return c;
  };

  for (const mission of MISSIONS) {
    const slot = panelById(mission.slotPanel);
    if (!slot) errors.push(`${mission.id}: unknown slot panel ${mission.slotPanel}`);
    if (mission.options.length !== 3) errors.push(`${mission.id}: needs exactly 3 options`);
    if ((mission.hints ?? []).length !== 3) errors.push(`${mission.id}: needs 3 hint levels`);
    const correct = [];
    for (const frameId of mission.options) {
      const c = checkFrame(frameId);
      if (!c) continue;
      const t = c[mission.target.by];
      report.push({ mission: mission.id, frame: frameId, type: t, angles: c.angleDegrees.map((a) => Math.round(a)).join('/'), matches: t === mission.target.type });
      if (t === mission.target.type) correct.push(frameId);
      // readability: angle options must be clearly right, or clearly away from 90°
      const maxA = Math.max(...c.angleDegrees);
      if (mission.target.by === 'angles' && c.angles !== 'right' && Math.abs(maxA - 90) < 8) {
        errors.push(`${mission.id}: ${frameId} largest angle ${maxA.toFixed(1)}° is too close to 90° to read`);
      }
    }
    if (correct.length !== 1) errors.push(`${mission.id}: expected exactly 1 correct option, found ${correct.length} (${correct.join(', ')})`);
    // the correct frame must physically match the slot it is delivered to
    if (slot && correct.length === 1) {
      const f = classify(framePoints(TRIANGLE_FRAMES[correct[0]]));
      if (sortedLengths(f) !== sortedLengths(classify(slot.points))) errors.push(`${mission.id}: ${correct[0]} does not fit slot ${slot.id}`);
    }
    if (slot && slot.stage !== mission.bridgeStage) errors.push(`${mission.id}: slot ${slot.id} belongs to stage ${slot.stage}`);
  }

  const stagesUsed = new Set(MISSIONS.map((m) => m.bridgeStage));
  if (stagesUsed.size !== MISSIONS.length) errors.push('two missions build the same bridge stage');

  for (const panel of PANELS) {
    const by = STAGE_SIDE_TYPES.includes(panel.stage) ? 'sides' : 'angles';
    const t = classify(panel.points)[by];
    if (t !== panel.stage) errors.push(`panel ${panel.id}: stage ${panel.stage} but geometry is ${t}`);
  }

  for (const [type, id] of Object.entries(REPORT_FRAMES)) {
    const c = checkFrame(id);
    const by = STAGE_SIDE_TYPES.includes(type) ? 'sides' : 'angles';
    if (c && c[by] !== type) errors.push(`report frame ${id} is not ${type}`);
  }

  return { ok: errors.length === 0, errors, report };
}
