// Structural layout of the bridge, in metres (x to the right from the left abutment, y up
// from the deck). Each triangular panel belongs to exactly one build stage; when a stage's
// mission is solved, every panel of that stage assembles at once.
//
// Panel geometry is built from the same side-length maths as the crane frames, so the
// isosceles frame the player lifts is the exact shape that completes the bridge.

import { verticesFromSides } from '../utils/geometry.js';

export const BRIDGE = {
  originX: 270, // screen px of x = 0 m (left end of the deck)
  deckY: 590, // screen px of y = 0 m (top of the deck)
  pxPerMetre: 25,
  span: 48, // metres
  deckThickness: 30,
  girderDepth: 22,
  pillars: [{ x: 24, width: 74, foot: 895 }],
  abutments: [
    { x: 0, side: 'left' },
    { x: 48, side: 'right' },
  ],
};

const SPAN = BRIDGE.span;
const shift = (pts, dx) => pts.map((p) => ({ x: p.x + dx, y: p.y }));
// Mirror across the centre line; reverse order so base stays points[0] -> points[1] left to right.
const mirror = (pts) => {
  const m = pts.map((p) => ({ x: SPAN - p.x, y: p.y }));
  return [m[1], m[0], m[2]];
};

const iso = shift(verticesFromSides({ base: 6, left: 8, right: 8 }), 6);
const scal = shift(verticesFromSides({ base: 6, left: 10, right: 9 }), 12);
const equi = shift(verticesFromSides({ base: 12, left: 12, right: 12 }), 18);
const right = verticesFromSides({ base: 6, left: 7.5, right: 4.5 });

const isoApex = iso[2];
const scalApex = scal[2];
const equiApex = equi[2];
const rightTop = right[2];

// Filler panels close the gaps between the primary frames (fully triangulated truss).
const fill1 = [{ x: 6, y: 0 }, isoApex, rightTop]; // obtuse
const fill2 = [{ x: 12, y: 0 }, scalApex, isoApex]; // acute
const fill3 = [{ x: 18, y: 0 }, equiApex, scalApex]; // obtuse

const pair = (id, stage, pts, extra = {}) => [
  { id: `${id}-L`, stage, points: pts, ...extra },
  { id: `${id}-R`, stage, points: mirror(pts), ...extra },
];

export const PANELS = [
  ...pair('right', 'right', right),
  ...pair('iso', 'isosceles', iso),
  ...pair('scal', 'scalene', scal),
  { id: 'equi-C', stage: 'equilateral', points: equi },
  ...pair('fill-1', 'obtuse', fill1),
  ...pair('fill-2', 'acute', fill2),
  ...pair('fill-3', 'obtuse', fill3),
];

// Extra structural members that assemble alongside a stage ("neighbouring beams").
export const CONNECTORS = [
  { stage: 'isosceles', kind: 'chordPlate', from: { x: 6, y: 0 }, to: { x: 12, y: 0 } },
  { stage: 'isosceles', kind: 'chordPlate', from: { x: 36, y: 0 }, to: { x: 42, y: 0 } },
  { stage: 'equilateral', kind: 'chordPlate', from: { x: 18, y: 0 }, to: { x: 30, y: 0 } },
  { stage: 'scalene', kind: 'chordPlate', from: { x: 12, y: 0 }, to: { x: 18, y: 0 } },
  { stage: 'scalene', kind: 'chordPlate', from: { x: 30, y: 0 }, to: { x: 36, y: 0 } },
  { stage: 'right', kind: 'chordPlate', from: { x: 0, y: 0 }, to: { x: 6, y: 0 } },
  { stage: 'right', kind: 'chordPlate', from: { x: 42, y: 0 }, to: { x: 48, y: 0 } },
];

// Top chord nodes left -> right (bunting, final details).
export const TOP_CHORD = [{ x: 0, y: 0 }, rightTop, isoApex, scalApex, equiApex, ...[scalApex, isoApex, rightTop].map((p) => ({ x: SPAN - p.x, y: p.y })), { x: SPAN, y: 0 }];

// Lamp posts installed in the final sequence (metres along the deck).
export const LAMPS = [3, 13.5, 24, 34.5, 45];

export const STAGE_SIDE_TYPES = ['equilateral', 'isosceles', 'scalene'];

export const toScreen = (p) => ({
  x: BRIDGE.originX + p.x * BRIDGE.pxPerMetre,
  y: BRIDGE.deckY - p.y * BRIDGE.pxPerMetre,
});

export const panelById = (id) => PANELS.find((p) => p.id === id);
export const panelsForStage = (stage) => PANELS.filter((p) => p.stage === stage);
export const connectorsForStage = (stage) => CONNECTORS.filter((c) => c.stage === stage);
