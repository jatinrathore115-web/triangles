// Procedural placeholder art in a faceted, low-poly, lightly hand-painted style.
// Every generator draws into a Canvas2D context of the size listed in the asset manifest.
// Light comes from the upper left; facets are lit or shaded according to their slope.
// Production art replaces these one by one through assetManifest.js.

import { COLORS } from '../config/theme.js';

// ---------- colour + random helpers ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function mix(h1, h2, t) {
  const a = rgb(h1);
  const b = rgb(h2);
  return (
    (Math.round(a[0] + (b[0] - a[0]) * t) << 16) |
    (Math.round(a[1] + (b[1] - a[1]) * t) << 8) |
    Math.round(a[2] + (b[2] - a[2]) * t)
  );
}

export function shade(hex, amt) {
  // amt > 0 lightens toward white, < 0 darkens toward black
  return amt >= 0 ? mix(hex, 0xffffff, amt) : mix(hex, 0x000000, -amt);
}

const css = (hex, a = 1) => {
  const [r, g, b] = rgb(hex);
  return a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
};

function poly(ctx, pts, fill, stroke = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    // hairline in the same colour hides anti-aliasing seams between facets
    ctx.strokeStyle = fill;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

/** Facet colour by orientation: light from upper-left. */
function facetShade(base, tri, rng, strength = 0.18) {
  const [a, b, c] = tri;
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  // pseudo normal from 2D shape: tilt toward light if centroid is left/up of facet
  const cx = (a[0] + b[0] + c[0]) / 3;
  const cy = (a[1] + b[1] + c[1]) / 3;
  const area = ux * vy - uy * vx;
  const skew = ((a[0] + b[0] + c[0] - 3 * cx) + (a[1] - cy) * 0.6) / 100; // ~0
  const n = (rng() - 0.5) * 2 * strength + Math.sign(area) * 0.02 + skew;
  return shade(base, n);
}

/** Jittered triangle grid clipped to the current path. */
function facetGrid(ctx, x0, y0, w, h, cell, rng, colorAt) {
  const cols = Math.ceil(w / cell) + 2;
  const rows = Math.ceil(h / cell) + 2;
  const pts = [];
  for (let r = 0; r < rows; r++) {
    pts[r] = [];
    for (let c = 0; c < cols; c++) {
      const jx = r === 0 || r === rows - 1 ? 0 : (rng() - 0.5) * cell * 0.7;
      const jy = (rng() - 0.5) * cell * 0.7;
      pts[r][c] = [x0 + (c - 1) * cell + jx + (r % 2) * cell * 0.5, y0 + (r - 1) * cell + jy];
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const p00 = pts[r][c];
      const p10 = pts[r][c + 1];
      const p01 = pts[r + 1][c];
      const p11 = pts[r + 1][c + 1];
      const t1 = [p00, p10, p11];
      const t2 = [p00, p11, p01];
      poly(ctx, t1, css(colorAt(t1, true)));
      poly(ctx, t2, css(colorAt(t2, false)));
    }
  }
}

const centre = (t) => [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];

// ---------- environment ----------

function sky(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(COLORS.skyTop));
  g.addColorStop(0.42, css(COLORS.skyMid));
  g.addColorStop(0.66, css(COLORS.skyHorizon));
  g.addColorStop(1, css(COLORS.haze));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // sun bloom from upper left, consistent with facet lighting
  const s = ctx.createRadialGradient(260, 120, 10, 260, 120, 760);
  s.addColorStop(0, 'rgba(255,246,220,0.55)');
  s.addColorStop(0.3, 'rgba(255,240,210,0.18)');
  s.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = s;
  ctx.fillRect(0, 0, w, h);

  // huge, barely visible facets give the sky the same low-poly language
  const rng = mulberry32(7);
  for (let i = 0; i < 14; i++) {
    const x = rng() * w;
    const y = rng() * h * 0.6;
    const r = 260 + rng() * 320;
    ctx.globalAlpha = 0.035;
    poly(ctx, [[x, y], [x + r, y + r * 0.3], [x + r * 0.2, y + r * 0.8]], '#ffffff', false);
  }
  ctx.globalAlpha = 1;
}

function mountainRange(ctx, w, h, rng, peaks, baseY, color, shadeColor, haze) {
  for (const pk of peaks) {
    const { x, top, half } = pk;
    const left = x - half;
    const right = x + half * (0.9 + rng() * 0.3);
    const midX = x + (rng() - 0.5) * half * 0.35;
    const shoulderL = [x - half * (0.45 + rng() * 0.15), top + (baseY - top) * (0.42 + rng() * 0.12)];
    const shoulderR = [x + half * (0.45 + rng() * 0.15), top + (baseY - top) * (0.4 + rng() * 0.12)];
    const ridge = [midX, top + (baseY - top) * 0.55];
    const lit = mix(color, COLORS.haze, haze);
    const dark = mix(shadeColor, COLORS.haze, haze * 0.85);
    // lit (west) faces
    poly(ctx, [[x, top], shoulderL, ridge], css(shade(lit, 0.1)));
    poly(ctx, [shoulderL, [left, baseY], ridge], css(lit));
    poly(ctx, [ridge, [left, baseY], [midX, baseY]], css(shade(lit, -0.04)));
    // shaded (east) faces
    poly(ctx, [[x, top], ridge, shoulderR], css(dark));
    poly(ctx, [ridge, [midX, baseY], shoulderR], css(shade(dark, 0.05)));
    poly(ctx, [shoulderR, [midX, baseY], [right, baseY]], css(shade(dark, -0.05)));
  }
}

function mountainsFar(ctx, w, h) {
  const rng = mulberry32(21);
  const base = h - 10;
  // back row, very hazy
  const back = [];
  for (let x = -80; x < w + 160; x += 210 + rng() * 120) back.push({ x, top: 120 + rng() * 120, half: 200 + rng() * 120 });
  mountainRange(ctx, w, h, rng, back, base, COLORS.mountainFar, COLORS.mountainFarShade, 0.55);
  // front row, a little crisper
  const front = [];
  for (let x = 40; x < w + 120; x += 260 + rng() * 160) front.push({ x, top: 220 + rng() * 110, half: 220 + rng() * 140 });
  mountainRange(ctx, w, h, rng, front, base, COLORS.mountainFar, COLORS.mountainFarShade, 0.25);

  const fade = ctx.createLinearGradient(0, h * 0.45, 0, h);
  fade.addColorStop(0, 'rgba(232,241,242,0)');
  fade.addColorStop(1, 'rgba(232,241,242,0.85)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
}

function lowPolyTree(ctx, x, y, s, rng, green = COLORS.hillNear) {
  const lit = shade(green, 0.06 + rng() * 0.06);
  const dark = shade(green, -0.22);
  ctx.fillStyle = css(COLORS.timberShade);
  ctx.fillRect(x - s * 0.06, y - s * 0.25, s * 0.12, s * 0.25);
  for (let i = 0; i < 2; i++) {
    const ty = y - s * 0.2 - i * s * 0.38;
    const tw = s * (0.42 - i * 0.1);
    const tt = ty - s * 0.6;
    poly(ctx, [[x, tt], [x - tw, ty], [x, ty]], css(lit));
    poly(ctx, [[x, tt], [x, ty], [x + tw, ty]], css(dark));
  }
}

function house(ctx, x, y, s, rng) {
  const wall = [0xe9dcc3, 0xd9c7a8, 0xe5d3b8][Math.floor(rng() * 3)];
  const roof = [0xb35a3c, 0xa04a35, 0x8a5a44][Math.floor(rng() * 3)];
  const ww = s;
  const wh = s * 0.7;
  poly(ctx, [[x, y], [x + ww * 0.62, y], [x + ww * 0.62, y - wh], [x, y - wh]], css(wall));
  poly(ctx, [[x + ww * 0.62, y], [x + ww, y - wh * 0.08], [x + ww, y - wh * 1.02], [x + ww * 0.62, y - wh]], css(shade(wall, -0.18)));
  poly(ctx, [[x - 2, y - wh], [x + ww * 0.31, y - wh - s * 0.5], [x + ww * 0.62 + 2, y - wh]], css(roof));
  poly(ctx, [[x + ww * 0.31, y - wh - s * 0.5], [x + ww * 0.72, y - wh * 1.6], [x + ww + 2, y - wh * 1.02], [x + ww * 0.62 + 2, y - wh]], css(shade(roof, -0.2)));
  ctx.fillStyle = css(0x5a6b7a, 0.7);
  ctx.fillRect(x + ww * 0.22, y - wh * 0.62, ww * 0.16, wh * 0.26);
}

function hillsMid(ctx, w, h) {
  const rng = mulberry32(33);
  // ridge line of rolling hills
  const ridge = [];
  for (let x = -40; x <= w + 40; x += 70 + rng() * 50) {
    const y = 120 + Math.sin(x / 260) * 46 + Math.sin(x / 97) * 18 + rng() * 22;
    ridge.push([x, y]);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ridge[0][0], h);
  ridge.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(w + 40, h);
  ctx.closePath();
  ctx.clip();
  const hazeBase = mix(COLORS.mountainMid, COLORS.haze, 0.3);
  facetGrid(ctx, 0, 60, w, h, 64, rng, (t) => {
    const [, cy] = centre(t);
    const depth = clamp((cy - 100) / (h - 100), 0, 1);
    const c = mix(hazeBase, mix(COLORS.hillNear, COLORS.haze, 0.25), depth);
    return facetShade(c, t, rng, 0.07);
  });
  ctx.restore();

  // tree line + two small towns on the far banks (story: Sunnyside & Riverdale)
  for (let i = 0; i < ridge.length - 1; i++) {
    const [x, y] = ridge[i];
    if (rng() < 0.55) lowPolyTree(ctx, x + rng() * 40, y + 14 + rng() * 20, 30 + rng() * 22, rng, mix(COLORS.hillNearShade, COLORS.haze, 0.3));
  }
  const towns = [
    { x: 120, n: 6 },
    { x: 1540, n: 7 },
  ];
  for (const t of towns) {
    for (let i = 0; i < t.n; i++) {
      const hx = t.x + i * 34 + rng() * 14;
      const ry = ridge.reduce((best, p) => (Math.abs(p[0] - hx) < Math.abs(best[0] - hx) ? p : best), ridge[0])[1];
      house(ctx, hx, ry + 58 + rng() * 26, 22 + rng() * 8, rng);
    }
  }
  const fade = ctx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, 'rgba(232,241,242,0.25)');
  fade.addColorStop(1, 'rgba(232,241,242,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
}

function rockFace(ctx, outline, w, h, rng, topY) {
  ctx.save();
  ctx.beginPath();
  outline.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.clip();
  facetGrid(ctx, 0, 0, w, h, 46, rng, (t) => {
    const [cx, cy] = centre(t);
    const d = clamp((cy - topY) / (h - topY), 0, 1);
    const band = Math.sin(cy / 38 + cx / 140) * 0.5 + 0.5; // strata
    let c = mix(COLORS.rockLight, COLORS.rockMid, d * 0.8 + band * 0.25);
    c = mix(c, COLORS.rockDark, clamp(d - 0.35, 0, 1));
    return facetShade(c, t, rng, 0.12);
  });
  ctx.restore();
}

function grassCap(ctx, edge, rng, thickness = 22) {
  // edge: array of [x,y] along the top of the land
  for (let i = 0; i < edge.length - 1; i++) {
    const [x1, y1] = edge[i];
    const [x2, y2] = edge[i + 1];
    const drip = thickness * (0.6 + rng() * 0.8);
    const mx = (x1 + x2) / 2;
    poly(ctx, [[x1, y1 - 2], [x2, y2 - 2], [mx, Math.max(y1, y2) + drip]], css(shade(COLORS.grassShade, (rng() - 0.5) * 0.1)));
    poly(ctx, [[x1, y1 - 2], [x2, y2 - 2], [mx, (y1 + y2) / 2 + drip * 0.45]], css(shade(COLORS.grass, (rng() - 0.3) * 0.12)));
  }
}

function cliffLeft(ctx, w, h) {
  const rng = mulberry32(41);
  const top = 50;
  // land surface then jagged face down to the waterline
  const outline = [
    [0, top],
    [120, top - 4],
    [250, top + 2],
    [312, top + 6],
    [334, 96],
    [328, 140],
    [352, 176],
    [366, 214],
    [392, 262],
    [420, 330],
    [420, h],
    [0, h],
  ];
  rockFace(ctx, outline, w, h, rng, top);
  // top soil
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, top - 6);
  ctx.lineTo(314, top - 2);
  ctx.lineTo(320, top + 26);
  ctx.lineTo(0, top + 30);
  ctx.closePath();
  ctx.fillStyle = css(COLORS.dirtShade);
  ctx.fill();
  ctx.restore();
  const edge = [];
  for (let x = 0; x <= 316; x += 26) edge.push([x, top - 4 + Math.sin(x / 40) * 2]);
  grassCap(ctx, edge, rng);
  for (let i = 0; i < 4; i++) lowPolyTree(ctx, 20 + i * 46 + rng() * 14, top + 2, 54 + rng() * 26, rng);
}

function cliffRight(ctx, w, h) {
  const rng = mulberry32(57);
  const top = 60;
  const outline = [
    [96, top + 6],
    [200, top],
    [400, top - 3],
    [w, top + 2],
    [w, h],
    [0, h],
    [0, 300],
    [22, 252],
    [40, 206],
    [62, 170],
    [72, 128],
    [90, 96],
  ];
  rockFace(ctx, outline, w, h, rng, top);
  ctx.fillStyle = css(COLORS.dirtShade);
  ctx.beginPath();
  ctx.moveTo(94, top + 4);
  ctx.lineTo(w, top - 2);
  ctx.lineTo(w, top + 32);
  ctx.lineTo(100, top + 30);
  ctx.closePath();
  ctx.fill();
  const edge = [];
  for (let x = 92; x <= w; x += 26) edge.push([x, top - 2 + Math.sin(x / 50) * 2]);
  grassCap(ctx, edge, rng);
  for (let i = 0; i < 3; i++) lowPolyTree(ctx, w - 30 - i * 40 - rng() * 10, top + 4, 56 + rng() * 30, rng);
}

function water(ctx, w, h) {
  const rng = mulberry32(63);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(mix(COLORS.waterLight, COLORS.haze, 0.35)));
  g.addColorStop(0.25, css(COLORS.waterLight));
  g.addColorStop(0.6, css(COLORS.waterMid));
  g.addColorStop(1, css(COLORS.waterDeep));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // faceted surface
  ctx.globalAlpha = 0.16;
  facetGrid(ctx, 0, 0, w, h, 70, rng, (t) => (rng() < 0.5 ? 0xffffff : COLORS.waterDeep));
  ctx.globalAlpha = 1;
  // far-bank reflection band
  const r = ctx.createLinearGradient(0, 0, 0, 40);
  r.addColorStop(0, 'rgba(80,120,100,0.35)');
  r.addColorStop(1, 'rgba(80,120,100,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, w, 40);
}

function yard(ctx, w, h) {
  const rng = mulberry32(71);
  // irregular rim where the near bank meets the water
  const rim = [];
  for (let x = 0; x <= w; x += 60) rim.push([x, 34 + Math.sin(x / 170) * 10 + rng() * 10]);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h);
  rim.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.clip();
  facetGrid(ctx, 0, 20, w, h, 58, rng, (t) => {
    const [cx, cy] = centre(t);
    const d = clamp(cy / h, 0, 1);
    let c = mix(COLORS.dirt, COLORS.dirtShade, d * 0.9);
    // centre of the yard is a touch lighter: that's where the frames sit
    const centreBias = 1 - clamp(Math.abs(cx - 940) / 900, 0, 1);
    c = shade(c, centreBias * 0.05);
    return facetShade(c, t, rng, 0.07);
  });
  ctx.restore();
  // stones along the rim
  for (let i = 0; i < rim.length; i++) {
    const [x, y] = rim[i];
    const s = 14 + rng() * 18;
    const sx = x + rng() * 30;
    poly(ctx, [[sx, y + 4], [sx + s * 0.4, y - s * 0.5], [sx + s, y - s * 0.2], [sx + s * 1.1, y + 6]], css(shade(COLORS.rockMid, 0.1)));
    poly(ctx, [[sx + s * 0.4, y - s * 0.5], [sx + s, y - s * 0.2], [sx + s * 1.1, y + 6], [sx + s * 0.6, y + 6]], css(COLORS.rockDark));
  }
  // grass tufts at outer edges only (keeps the centre clean for the frames)
  for (let i = 0; i < 26; i++) {
    const left = rng() < 0.5;
    const x = left ? rng() * 360 : w - rng() * 360;
    const y = 60 + rng() * (h - 80);
    for (let b = 0; b < 4; b++) {
      const bx = x + b * 5;
      poly(ctx, [[bx, y], [bx + 3, y - 12 - rng() * 10], [bx + 6, y]], css(shade(COLORS.grass, (rng() - 0.5) * 0.2)), false);
    }
  }
  // soft vignette at the very bottom
  const v = ctx.createLinearGradient(0, h * 0.5, 0, h);
  v.addColorStop(0, 'rgba(40,28,18,0)');
  v.addColorStop(1, 'rgba(40,28,18,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function cloud(ctx, w, h, seed) {
  const rng = mulberry32(seed);
  const blobs = 5 + Math.floor(rng() * 3);
  const base = h * 0.78;
  for (let i = 0; i < blobs; i++) {
    const cx = w * (0.15 + (i / (blobs - 1)) * 0.7);
    const r = h * (0.28 + rng() * 0.22) * (1 - Math.abs(i / (blobs - 1) - 0.5) * 0.8);
    const sides = 7;
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const a = Math.PI + (k / (sides - 1)) * Math.PI;
      pts.push([cx + Math.cos(a) * r * 1.2, base + Math.sin(a) * r * 1.6]);
    }
    for (let k = 0; k < pts.length - 1; k++) {
      const lit = k < pts.length / 2;
      poly(ctx, [[cx, base], pts[k], pts[k + 1]], css(lit ? 0xffffff : 0xeef4f8));
    }
  }
  poly(ctx, [[w * 0.06, base], [w * 0.94, base], [w * 0.8, base + h * 0.12], [w * 0.2, base + h * 0.12]], css(0xdbe7ef));
}

// ---------- bridge structure ----------

function pillar(ctx, w, h) {
  const rng = mulberry32(81);
  const topW = 74;
  const botW = 98;
  const cx = w / 2;
  const capH = 26;
  // cap
  poly(ctx, [[cx - w / 2 + 4, 0], [cx + w / 2 - 4, 0], [cx + w / 2 - 10, capH], [cx - w / 2 + 10, capH]], css(shade(COLORS.concrete, 0.08)));
  poly(ctx, [[cx - w / 2 + 10, capH], [cx + w / 2 - 10, capH], [cx + w / 2 - 14, capH + 8], [cx - w / 2 + 14, capH + 8]], css(COLORS.concreteDark));
  // shaft: lit west half, shaded east half, faceted
  const L0 = cx - topW / 2;
  const R0 = cx + topW / 2;
  const L1 = cx - botW / 2;
  const R1 = cx + botW / 2;
  const y0 = capH + 8;
  poly(ctx, [[L0, y0], [cx, y0], [cx, h], [L1, h]], css(COLORS.concrete));
  poly(ctx, [[cx, y0], [R0, y0], [R1, h], [cx, h]], css(COLORS.concreteShade));
  for (let y = y0 + 30; y < h; y += 34 + rng() * 10) {
    ctx.strokeStyle = 'rgba(60,56,50,0.25)';
    ctx.lineWidth = 2;
    const t = (y - y0) / (h - y0);
    ctx.beginPath();
    ctx.moveTo(L0 + (L1 - L0) * t, y);
    ctx.lineTo(R0 + (R1 - R0) * t, y);
    ctx.stroke();
  }
  // edge highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(L0 + 2, y0);
  ctx.lineTo(L1 + 2, h);
  ctx.stroke();
  // wet base
  const g = ctx.createLinearGradient(0, h - 90, 0, h);
  g.addColorStop(0, 'rgba(20,50,60,0)');
  g.addColorStop(1, 'rgba(20,50,60,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, h - 90, w, 90);
}

function abutment(ctx, w, h, flip) {
  const rng = mulberry32(flip ? 92 : 91);
  ctx.save();
  if (flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  // stepped stone abutment wall
  const rows = 5;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -18 : 0;
    while (x < w) {
      const bw = 34 + rng() * 20;
      const y = r * rh;
      const c = shade(COLORS.concrete, (rng() - 0.5) * 0.16 - r * 0.04);
      poly(ctx, [[x + 2, y + 2], [x + bw - 2, y + 2], [x + bw - 2, y + rh - 2], [x + 2, y + rh - 2]], css(c));
      poly(ctx, [[x + bw - 2, y + 2], [x + bw - 2, y + rh - 2], [x + bw - 8, y + rh - 2]], css(shade(c, -0.15)));
      x += bw;
    }
  }
  ctx.restore();
}

// ---------- construction props ----------

function cone(ctx, w, h) {
  const cx = w / 2;
  poly(ctx, [[4, h - 8], [w - 4, h - 8], [w - 2, h], [2, h]], css(COLORS.hazardDark));
  poly(ctx, [[cx, 2], [cx - 15, h - 8], [cx, h - 8]], css(0xf07a2a));
  poly(ctx, [[cx, 2], [cx, h - 8], [cx + 15, h - 8]], css(0xc85a17));
  ctx.fillStyle = '#f4f0e8';
  ctx.beginPath();
  ctx.moveTo(cx - 9, h * 0.42);
  ctx.lineTo(cx + 9, h * 0.42);
  ctx.lineTo(cx + 11.5, h * 0.58);
  ctx.lineTo(cx - 11.5, h * 0.58);
  ctx.closePath();
  ctx.fill();
}

function ibeam(ctx, x, y, len, hgt, c) {
  poly(ctx, [[x, y], [x + len, y], [x + len, y + hgt * 0.22], [x, y + hgt * 0.22]], css(shade(c, 0.18)));
  poly(ctx, [[x, y + hgt * 0.22], [x + len, y + hgt * 0.22], [x + len, y + hgt * 0.78], [x, y + hgt * 0.78]], css(shade(c, -0.12)));
  poly(ctx, [[x, y + hgt * 0.78], [x + len, y + hgt * 0.78], [x + len, y + hgt], [x, y + hgt]], css(c));
  poly(ctx, [[x + len, y], [x + len + 8, y + 4], [x + len + 8, y + hgt + 2], [x + len, y + hgt]], css(shade(c, -0.3)));
}

function beamStack(ctx, w, h) {
  const rows = [
    [10, h - 26, w - 30],
    [22, h - 50, w - 50],
    [4, h - 74, w - 60],
  ];
  rows.forEach(([x, y, len], i) => ibeam(ctx, x, y, len, 22, i === 1 ? COLORS.rust : COLORS.steel));
  ctx.fillStyle = css(COLORS.timberShade);
  ctx.fillRect(30, h - 4, 18, 4);
  ctx.fillRect(w - 70, h - 4, 18, 4);
}

function crate(ctx, w, h) {
  poly(ctx, [[0, 12], [w - 16, 12], [w - 16, h], [0, h]], css(COLORS.timber));
  poly(ctx, [[w - 16, 12], [w, 2], [w, h - 10], [w - 16, h]], css(COLORS.timberShade));
  poly(ctx, [[0, 12], [16, 2], [w, 2], [w - 16, 12]], css(shade(COLORS.timber, 0.15)));
  ctx.strokeStyle = css(shade(COLORS.timberShade, -0.2));
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 17, w - 26, h - 22);
  ctx.beginPath();
  ctx.moveTo(5, 17);
  ctx.lineTo(w - 21, h - 5);
  ctx.stroke();
}

function pallet(ctx, w, h) {
  // timber skid the frames stand on
  poly(ctx, [[6, 0], [w - 6, 0], [w, 8], [0, 8]], css(shade(COLORS.timber, 0.12)));
  poly(ctx, [[0, 8], [w, 8], [w, 16], [0, 16]], css(COLORS.timber));
  for (const x of [8, w / 2 - 14, w - 36]) {
    poly(ctx, [[x, 16], [x + 28, 16], [x + 28, h], [x, h]], css(COLORS.timberShade));
  }
  ctx.strokeStyle = 'rgba(60,35,15,0.35)';
  ctx.lineWidth = 1;
  for (let x = 30; x < w; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 9);
    ctx.lineTo(x, 15);
    ctx.stroke();
  }
}

function barrier(ctx, w, h) {
  ctx.fillStyle = css(COLORS.hazardDark);
  ctx.fillRect(10, 14, 6, h - 14);
  ctx.fillRect(w - 16, 14, 6, h - 14);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 4, w, 18);
  ctx.clip();
  ctx.fillStyle = css(COLORS.hazard);
  ctx.fillRect(0, 4, w, 18);
  ctx.fillStyle = css(COLORS.hazardDark);
  for (let x = -20; x < w + 20; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.lineTo(x + 12, 22);
    ctx.lineTo(x + 24, 4);
    ctx.lineTo(x + 12, 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- fx ----------

function radial(ctx, w, h, stops) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const GENERATORS = {
  sky,
  mountainsFar,
  hillsMid,
  cliffLeft,
  cliffRight,
  water,
  yard,
  cloudA: (ctx, w, h) => cloud(ctx, w, h, 101),
  cloudB: (ctx, w, h) => cloud(ctx, w, h, 202),
  tree: (ctx, w, h) => lowPolyTree(ctx, w / 2, h, h * 0.95, mulberry32(5)),
  pillar,
  abutmentLeft: (ctx, w, h) => abutment(ctx, w, h, false),
  abutmentRight: (ctx, w, h) => abutment(ctx, w, h, true),
  cone,
  beamStack,
  crate,
  pallet,
  barrier,
  spark: (ctx, w, h) => radial(ctx, w, h, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,230,160,0.95)'], [1, 'rgba(255,170,60,0)']]),
  dust: (ctx, w, h) => radial(ctx, w, h, [[0, 'rgba(225,205,175,0.75)'], [0.6, 'rgba(215,195,165,0.3)'], [1, 'rgba(205,185,155,0)']]),
  glow: (ctx, w, h) => radial(ctx, w, h, [[0, 'rgba(255,214,140,0.9)'], [0.4, 'rgba(255,190,100,0.35)'], [1, 'rgba(255,170,80,0)']]),
  confetti: (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  },
  shimmer: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  },
};

/** Generate one manifest texture into Phaser's texture manager. */
export function generateTexture(scene, key, entry) {
  const fn = GENERATORS[entry.generator];
  if (!fn) throw new Error(`No procedural generator "${entry.generator}" for ${key}`);
  const [w, h] = entry.size;
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.getContext();
  fn(ctx, w, h);
  tex.refresh();
  return tex;
}
