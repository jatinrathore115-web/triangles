// Catalogue of physical triangular frames the crane can lift.
// A frame is defined EITHER by side lengths (metres) OR by a bridge panel it is cut to fit.
// Vertices, tick marks, angle readings and classification are all derived, so the maths
// on screen can never drift from the data.
//
// sides: base = AB (on the ground), left = CA, right = BC (C = apex / lift point)

import { verticesFromSides } from '../utils/geometry.js';
import { panelById } from './bridgeLayout.js';

export const TRIANGLE_FRAMES = {
  // --- side-based stage ---
  'equilateral-6': { sides: { base: 6, left: 6, right: 6 }, material: 'steel' },
  'equilateral-12': { sides: { base: 12, left: 12, right: 12 }, material: 'steelWarm' },
  'isosceles-6-8-8': { sides: { base: 6, left: 8, right: 8 }, material: 'steelWarm' },
  'isosceles-6-9-9': { sides: { base: 6, left: 9, right: 9 }, material: 'steel' },
  'isosceles-12-9.5': { sides: { base: 12, left: 9.5, right: 9.5 }, material: 'steelCool' },
  'scalene-6-10-9': { sides: { base: 6, left: 10, right: 9 }, material: 'steelCool' },
  'scalene-12-11-8': { sides: { base: 12, left: 11, right: 8 }, material: 'steel' },

  // --- angle-based stage ---
  'acute-upper': { panel: 'fill-2-L', material: 'steelCool' }, // cut to the upper chord gap
  'acute-6-6.5-5': { sides: { base: 6, left: 6.5, right: 5 }, material: 'steel' },
  'acute-9-8-7': { sides: { base: 9, left: 8, right: 7 }, material: 'steelWarm' },
  'right-6-4.5-7.5': { sides: { base: 6, left: 7.5, right: 4.5 }, material: 'steelWarm' },
  'right-8-10-6': { sides: { base: 8, left: 10, right: 6 }, material: 'steel' },
  'obtuse-lower': { panel: 'fill-1-L', material: 'steelWarm' }, // cut to the end-bay gap
  'obtuse-6-8.5-4': { sides: { base: 6, left: 8.5, right: 4 }, material: 'steelCool' },
  'obtuse-8-10.5-4': { sides: { base: 8, left: 10.5, right: 4 }, material: 'steelCool' },
};
for (const [id, f] of Object.entries(TRIANGLE_FRAMES)) f.id = id;

/** Vertices (metres, y up) in the orientation the frame has when installed. */
export function framePoints(def) {
  if (def.sides) return verticesFromSides(def.sides);
  const panel = panelById(def.panel);
  if (!panel) throw new Error(`Frame ${def.id}: unknown panel ${def.panel}`);
  return panel.points.map((p) => ({ ...p }));
}

// Human-facing vocabulary for each classification.
export const TRIANGLE_TYPES = {
  equilateral: { name: 'Equilateral Triangle', short: 'Equilateral', rule: 'All 3 sides are equal.', spec: 'All 3 sides equal', by: 'sides', code: 'EQU' },
  isosceles: { name: 'Isosceles Triangle', short: 'Isosceles', rule: 'Exactly 2 equal sides.', spec: 'Exactly 2 equal sides', by: 'sides', code: 'ISO' },
  scalene: { name: 'Scalene Triangle', short: 'Scalene', rule: 'All 3 sides are different.', spec: 'All 3 sides different', by: 'sides', code: 'SCA' },
  acute: { name: 'Acute Triangle', short: 'Acute', rule: 'All 3 angles are less than 90°.', spec: 'All angles < 90°', by: 'angles', code: 'ACU' },
  right: { name: 'Right Triangle', short: 'Right', rule: 'One angle is exactly 90°.', spec: 'One angle = 90°', by: 'angles', code: 'RGT' },
  obtuse: { name: 'Obtuse Triangle', short: 'Obtuse', rule: 'One angle is greater than 90°.', spec: 'One angle > 90°', by: 'angles', code: 'OBT' },
};

// Representative components for the Structural Report (one per type).
export const REPORT_FRAMES = {
  isosceles: 'isosceles-6-8-8',
  equilateral: 'equilateral-6',
  scalene: 'scalene-6-10-9',
  acute: 'acute-6-6.5-5',
  right: 'right-6-4.5-7.5',
  obtuse: 'obtuse-6-8.5-4',
};
