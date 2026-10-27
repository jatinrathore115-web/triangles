// Pure triangle maths. No Phaser imports: this module is shared by the game,
// the data validator script, and any future authoring tools.

export const EPS_LENGTH = 0.02; // metres
export const EPS_ANGLE = 0.25; // degrees

export const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

/**
 * Build a triangle from side lengths with the base on the x-axis.
 * Returns vertices in "world metres" (y up): A=(0,0), B=(base,0), C=apex,
 * where |AC| = left and |BC| = right.
 */
export function verticesFromSides({ base, left, right }) {
  if (!isValidTriangle(base, left, right)) {
    throw new Error(`Invalid triangle sides ${base}, ${left}, ${right}`);
  }
  const x = (left * left - right * right + base * base) / (2 * base);
  const y = Math.sqrt(Math.max(0, left * left - x * x));
  return [
    { x: 0, y: 0 },
    { x: base, y: 0 },
    { x, y },
  ];
}

export function isValidTriangle(a, b, c) {
  return a + b > c && a + c > b && b + c > a;
}

/** Side list in edge order: AB (base), BC (right), CA (left). */
export function edgesOf(pts) {
  return [
    { from: 0, to: 1, length: dist(pts[0], pts[1]) },
    { from: 1, to: 2, length: dist(pts[1], pts[2]) },
    { from: 2, to: 0, length: dist(pts[2], pts[0]) },
  ];
}

/** Interior angle at each vertex, in degrees. */
export function anglesOf(pts) {
  return pts.map((p, i) => {
    const a = pts[(i + 1) % 3];
    const b = pts[(i + 2) % 3];
    const v1 = { x: a.x - p.x, y: a.y - p.y };
    const v2 = { x: b.x - p.x, y: b.y - p.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
    return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  });
}

const near = (a, b, eps) => Math.abs(a - b) <= eps;

export function classifyBySides(lengths) {
  const [a, b, c] = lengths;
  const ab = near(a, b, EPS_LENGTH);
  const bc = near(b, c, EPS_LENGTH);
  const ca = near(c, a, EPS_LENGTH);
  if (ab && bc) return 'equilateral';
  if (ab || bc || ca) return 'isosceles';
  return 'scalene';
}

export function classifyByAngles(angles) {
  const max = Math.max(...angles);
  if (near(max, 90, EPS_ANGLE)) return 'right';
  return max > 90 ? 'obtuse' : 'acute';
}

export function classify(pts) {
  const edges = edgesOf(pts);
  const angles = anglesOf(pts);
  return {
    sides: classifyBySides(edges.map((e) => e.length)),
    angles: classifyByAngles(angles),
    edges,
    angleDegrees: angles,
  };
}

/**
 * Equal-length tick convention: sides with the same number of ticks are equal.
 * Different lengths always get a different tick count, so the marking is never ambiguous.
 *   equilateral -> 1,1,1   isosceles -> 1,1,2   scalene -> 1,2,3
 * Returns tick count per edge (edge order of edgesOf).
 */
export function tickCounts(edges) {
  const groups = [];
  edges.forEach((e, i) => {
    const g = groups.find((grp) => near(grp.length, e.length, EPS_LENGTH));
    if (g) g.members.push(i);
    else groups.push({ length: e.length, members: [i] });
  });
  // Largest group first so the "equal" relationship always reads as a single tick.
  groups.sort((g1, g2) => g2.members.length - g1.members.length || g1.length - g2.length);
  const ticks = new Array(edges.length).fill(0);
  groups.forEach((g, gi) => g.members.forEach((m) => (ticks[m] = gi + 1)));
  return ticks;
}

/** Indices of edges that belong to a set of equal sides (size >= 2). */
export function equalEdgeIndices(edges) {
  const out = new Set();
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (near(edges[i].length, edges[j].length, EPS_LENGTH)) {
        out.add(i);
        out.add(j);
      }
    }
  }
  return [...out];
}

export const centroid = (pts) => ({
  x: (pts[0].x + pts[1].x + pts[2].x) / 3,
  y: (pts[0].y + pts[1].y + pts[2].y) / 3,
});

/** Format a length in metres for stamped plates: "8 m", "7.5 m". */
export const formatLength = (m) => `${Number.isInteger(Math.round(m * 10) / 10) ? Math.round(m) : (Math.round(m * 10) / 10).toFixed(1)} m`;
