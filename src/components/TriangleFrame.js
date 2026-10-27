// A physical triangular steel frame: beams, gusset plates, lock bolts and the educational
// markings (painted side ticks + stamped lengths, or angle arcs / right-angle square +
// stamped degree readings). All maths is derived from the triangle's points, so the
// drawing is always mathematically faithful.
//
// Local origin = midpoint of edge points[0] -> points[1]; +y is down. Points are given in
// the orientation the frame has when INSTALLED on the bridge (rotation 0).

import Phaser from 'phaser';
import { COLORS, FONTS, toCss } from '../config/theme.js';
import { classify, tickCounts, equalEdgeIndices, formatLength } from '../utils/geometry.js';
import { shade, mulberry32 } from '../systems/ProceduralArt.js';
import { stopTweensOf } from '../utils/async.js';

const MATERIALS = {
  steel: 0x5d6b79,
  steelWarm: 0x66696f,
  steelCool: 0x566a7b,
};

const BEAM_METRES = 0.52;
const LIGHT = { x: -0.6, y: -0.8 }; // upper-left, screen space

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
const len = (a) => Math.hypot(a.x, a.y);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const rot = (p, r) => ({ x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) });

export class TriangleFrame extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} cfg
   * @param {{x:number,y:number}[]} cfg.points  vertices in metres, y up (installed orientation)
   * @param {number} cfg.pxPerMetre
   * @param {'sides'|'angles'|'none'} [cfg.markings]
   * @param {boolean} [cfg.showLabels]  stamped lengths (sides) or degree readings (angles)
   * @param {number} [cfg.minLabelPx]  minimum stamped-label font size
   * @param {string} [cfg.material]
   * @param {number} [cfg.seed]
   * @param {string} [cfg.id]
   */
  constructor(scene, cfg) {
    super(scene, 0, 0);
    this.cfg = { markings: 'sides', showLabels: false, ...cfg };
    this.frameId = cfg.id;
    this.math = classify(cfg.points);
    this.ticks = tickCounts(this.math.edges);
    this.equalEdges = equalEdgeIndices(this.math.edges);
    this.degrees = this.math.angleDegrees;

    const S = cfg.pxPerMetre;
    const mid = lerp(cfg.points[0], cfg.points[1], 0.5);
    this.local = cfg.points.map((p) => ({ x: (p.x - mid.x) * S, y: -(p.y - mid.y) * S }));
    this.beam = BEAM_METRES * S;
    this.baseColor = MATERIALS[cfg.material] ?? MATERIALS.steel;
    this.rng = mulberry32(cfg.seed ?? 1);
    this.carryRot = 0;

    this.computeInset();

    this.guide = scene.add.graphics();
    this.rim = scene.add.graphics();
    this.body = scene.add.graphics();
    this.add([this.rim, this.body, this.guide]);
    this.drawRim(COLORS.accentWarm);
    this.drawBody();

    const m = this.cfg.markings;
    this.tickMarks = this.math.edges.map((e, i) => (m === 'sides' ? this.makeTicks(i) : null));
    this.angleMarks = this.local.map((v, i) => (m === 'angles' ? this.makeAngleMark(i) : null));
    this.lockBolts = this.local.map((v, i) => this.makeLockBolt(i));
    this.labels = [];
    if (m === 'sides') this.labels = this.math.edges.map((e, i) => this.makeLengthPlate(i));
    if (m === 'angles') this.labels = this.local.map((v, i) => this.makeDegreePlate(i));
    this.labels.forEach((l) => l.setVisible(this.cfg.showLabels));

    this.rim.setAlpha(0);
    scene.events.on('update', this.syncLabels, this);
    this.once('destroy', () => scene.events.off('update', this.syncLabels, this));
  }

  // ---------- geometry ----------

  computeInset() {
    const [A, B, C] = this.local;
    const a = len(sub(B, C));
    const b = len(sub(C, A));
    const c = len(sub(A, B));
    const p = a + b + c;
    this.incentre = { x: (a * A.x + b * B.x + c * C.x) / p, y: (a * A.y + b * B.y + c * C.y) / p };
    const s = p / 2;
    const area = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
    const r = area / s;
    this.inradius = r;
    const k = Math.max(0.12, (r - this.beam) / r);
    this.inner = this.local.map((v) => add(this.incentre, mul(sub(v, this.incentre), k)));
    this.expandOuter = (px) => this.local.map((v) => add(this.incentre, mul(sub(v, this.incentre), (r + px) / r)));
  }

  /** Outward unit normal of edge i (edge i runs vertex i -> i+1). */
  edgeNormal(i) {
    const v1 = this.local[i];
    const v2 = this.local[(i + 1) % 3];
    const d = norm(sub(v2, v1));
    let n = { x: d.y, y: -d.x };
    const m = lerp(v1, v2, 0.5);
    if ((m.x - this.incentre.x) * n.x + (m.y - this.incentre.y) * n.y < 0) n = mul(n, -1);
    return n;
  }

  edgeMid(i) {
    const o = lerp(this.local[i], this.local[(i + 1) % 3], 0.5);
    const inn = lerp(this.inner[i], this.inner[(i + 1) % 3], 0.5);
    return lerp(o, inn, 0.5);
  }

  /** The lift point: the highest vertex when installed. The hook always grabs this. */
  get liftIndex() {
    let best = 0;
    this.local.forEach((v, i) => v.y < this.local[best].y && (best = i));
    return best;
  }

  get apexLocal() {
    return this.local[this.liftIndex];
  }

  /**
   * Resting pose in the yard: the frame stands on the edge opposite its lift point, so the
   * crane hook can reach the lift point from above. Returns the container rotation.
   */
  get restRotation() {
    const li = this.liftIndex;
    const P = this.local[(li + 1) % 3];
    const Q = this.local[(li + 2) % 3];
    let r = -Math.atan2(Q.y - P.y, Q.x - P.x);
    const lift = rot(this.local[li], r);
    const base = rot(P, r);
    if (lift.y > base.y) r += Math.PI;
    return Math.atan2(Math.sin(r), Math.cos(r));
  }

  /** Local vertices rotated by r (for yard layout). */
  rotatedLocal(r) {
    return this.local.map((v) => rot(v, r));
  }

  get heightPx() {
    const ys = this.local.map((v) => v.y);
    return Math.max(...ys) - Math.min(...ys);
  }

  get widthPx() {
    const xs = this.local.map((v) => v.x);
    return Math.max(...xs) - Math.min(...xs);
  }

  // ---------- drawing ----------

  drawRim(color, inner = COLORS.selectCyan) {
    const g = this.rim;
    g.clear();
    const layers = [
      [14, 0.12],
      [9, 0.22],
      [5, 0.5],
    ];
    for (const [w, a] of layers) {
      g.lineStyle(w, color, a);
      g.strokePoints(this.expandOuter(w * 0.5 + 2), true, true);
    }
    g.lineStyle(2.5, inner, 0.95);
    g.strokePoints(this.expandOuter(2.5), true, true);
  }

  drawBody() {
    const g = this.body;
    const O = this.local;
    const I = this.inner;
    const bw = this.beam;

    // dark outline ring behind the beams for crisp edges (interior stays open)
    const E = this.expandOuter(1.8);
    const Ii = this.local.map((v, k) => lerp(I[k], this.incentre, 0.03));
    g.fillStyle(COLORS.steelEdge, 1);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      g.fillPoints([E[i], E[j], Ii[j], Ii[i]], true);
    }

    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      const n = this.edgeNormal(i);
      const lit = n.x * LIGHT.x + n.y * LIGHT.y;
      const c = shade(this.baseColor, lit * 0.22);
      g.fillStyle(c, 1);
      g.fillPoints([O[i], O[j], I[j], I[i]], true);

      // bevel: flange highlight on the outer edge, shadow on the inner edge
      g.lineStyle(Math.max(1.5, bw * 0.16), shade(c, 0.32), 1);
      g.lineBetween(O[i].x - n.x * 1.2, O[i].y - n.y * 1.2, O[j].x - n.x * 1.2, O[j].y - n.y * 1.2);
      g.lineStyle(Math.max(1.2, bw * 0.14), shade(c, -0.35), 1);
      g.lineBetween(I[i].x, I[i].y, I[j].x, I[j].y);

      const a = lerp(O[i], I[i], 0.5);
      const b = lerp(O[j], I[j], 0.5);
      g.lineStyle(Math.max(1, bw * 0.1), shade(c, -0.18), 0.9);
      g.lineBetween(a.x, a.y, b.x, b.y);

      const L = len(sub(b, a));
      const step = Math.max(14, bw * 1.7);
      const count = Math.floor((L - bw * 5) / step);
      for (let k = 1; k <= count; k++) {
        const p = lerp(a, b, (bw * 2.5 + k * step) / L);
        g.fillStyle(shade(c, -0.3), 1);
        g.fillCircle(p.x + 0.6, p.y + 0.6, Math.max(1.2, bw * 0.13));
        g.fillStyle(shade(c, 0.35), 1);
        g.fillCircle(p.x, p.y, Math.max(1, bw * 0.1));
      }

      for (let k = 0; k < 2; k++) {
        if (this.rng() < 0.6) {
          const t = 0.2 + this.rng() * 0.6;
          const p = lerp(lerp(O[i], I[i], 0.3 + this.rng() * 0.4), lerp(O[j], I[j], 0.3 + this.rng() * 0.4), t);
          g.fillStyle(shade(c, -0.12), 0.5);
          g.fillEllipse(p.x, p.y, bw * (0.8 + this.rng()), bw * 0.35);
        }
      }
    }

    // gusset plates at the corners
    for (let i = 0; i < 3; i++) {
      const V = O[i];
      const u1 = norm(sub(O[(i + 1) % 3], V));
      const u2 = norm(sub(O[(i + 2) % 3], V));
      const gl = bw * 2.1;
      const plate = [add(V, mul(u1, gl)), V, add(V, mul(u2, gl)), lerp(I[i], add(V, mul(add(u1, u2), gl * 0.7)), 0.5)];
      const pc = shade(this.baseColor, 0.12);
      g.fillStyle(pc, 1);
      g.fillPoints(plate, true);
      g.lineStyle(1.2, shade(pc, -0.45), 0.9);
      g.strokePoints(plate, true, true);
    }
  }

  makeLockBolt(i) {
    const V = this.local[i];
    const toIn = norm(sub(this.inner[i], V));
    const p = add(V, mul(toIn, Math.min(this.beam * 0.95, len(sub(this.inner[i], V)) * 0.45)));
    const r = Math.max(3, this.beam * 0.34);
    const g = this.scene.add.graphics({ x: p.x, y: p.y });
    const hex = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      hex.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    g.fillStyle(COLORS.boltShade, 1);
    g.fillPoints(hex.map((h) => ({ x: h.x + 0.8, y: h.y + 0.8 })), true);
    g.fillStyle(COLORS.bolt, 1);
    g.fillPoints(hex, true);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(-r * 0.25, -r * 0.25, r * 0.35);
    g.fillStyle(COLORS.boltShade, 1);
    g.fillCircle(0, 0, r * 0.28);
    this.add(g);
    return g;
  }

  // ----- side markings -----

  makeTicks(i) {
    const v1 = this.local[i];
    const v2 = this.local[(i + 1) % 3];
    const m = this.edgeMid(i);
    const c = this.scene.add.container(m.x, m.y);
    c.setRotation(Math.atan2(v2.y - v1.y, v2.x - v1.x));
    const g = this.scene.add.graphics();
    c.add(g);
    c.paint = (lit) => {
      const count = this.ticks[i];
      const L = this.beam + Math.max(13, this.beam * 1.25);
      const gap = Math.max(6.5, this.beam * 0.62);
      const w = Math.max(3.6, this.beam * 0.36);
      const x0 = -((count - 1) * gap) / 2;
      g.clear();
      const stroke = (color, width, alpha = 1) => {
        g.lineStyle(width, color, alpha);
        for (let k = 0; k < count; k++) g.lineBetween(x0 + k * gap, -L / 2, x0 + k * gap, L / 2);
      };
      if (lit) stroke(COLORS.markingPulse, w + 9, 0.35);
      stroke(COLORS.markingOutline, w + 2.6);
      stroke(lit ? COLORS.markingPulse : COLORS.marking, w);
    };
    c.paint(false);
    this.add(c);
    return c;
  }

  makeLengthPlate(i) {
    const n = this.edgeNormal(i);
    const m = this.edgeMid(i);
    const off = this.beam * 0.5 + (i === 0 ? 19 : 30);
    return this.makePlate(add(m, mul(n, off)), formatLength(this.math.edges[i].length));
  }

  // ----- angle markings -----

  /** Arc (or right-angle square) drawn in the open corner at vertex i. */
  makeAngleMark(i) {
    const I = this.inner;
    const P = I[i];
    const d1 = norm(sub(I[(i + 1) % 3], P));
    const d2 = norm(sub(I[(i + 2) % 3], P));
    const shortest = Math.min(len(sub(I[(i + 1) % 3], P)), len(sub(I[(i + 2) % 3], P)));
    const r = Phaser.Math.Clamp(this.beam * 2.3, 12, Math.max(12, shortest * 0.46));
    const isRight = Math.abs(this.degrees[i] - 90) < 0.25;
    const c = this.scene.add.container(P.x, P.y);
    const g = this.scene.add.graphics();
    c.add(g);
    const a1 = Math.atan2(d1.y, d1.x);
    const a2 = Math.atan2(d2.y, d2.x);
    // sweep the interior angle (the smaller signed sweep)
    let start = a1;
    let sweep = a2 - a1;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;
    if (sweep < 0) {
      start = a2;
      sweep = -sweep;
    }
    c.paint = (lit, guide = false) => {
      g.clear();
      const w = Math.max(2.6, this.beam * 0.26);
      const main = lit || guide ? COLORS.markingPulse : COLORS.marking;
      if (guide) {
        g.fillStyle(COLORS.selectCyan, 0.35);
        g.slice(0, 0, r * 1.7, start, start + sweep, false);
        g.fillPath();
      }
      if (isRight) {
        const s = r * 0.78;
        const pts = [mul(d1, s), add(mul(d1, s), mul(d2, s)), mul(d2, s)];
        g.fillStyle(main, guide ? 0.55 : 0.28);
        g.fillPoints([{ x: 0, y: 0 }, ...pts], true);
        g.lineStyle(w + 2.6, COLORS.markingOutline, 1);
        g.strokePoints(pts, false);
        g.lineStyle(w, main, 1);
        g.strokePoints(pts, false);
      } else {
        g.fillStyle(main, guide ? 0.5 : 0.22);
        g.slice(0, 0, r, start, start + sweep, false);
        g.fillPath();
        g.lineStyle(w + 2.6, COLORS.markingOutline, 1);
        g.beginPath();
        g.arc(0, 0, r, start, start + sweep, false);
        g.strokePath();
        g.lineStyle(w, main, 1);
        g.beginPath();
        g.arc(0, 0, r, start, start + sweep, false);
        g.strokePath();
        if (this.degrees[i] > 90.25) {
          // obtuse: a second arc makes the wide angle unmistakable
          g.lineStyle(w * 0.8, main, 1);
          g.beginPath();
          g.arc(0, 0, r * 0.66, start, start + sweep, false);
          g.strokePath();
        }
      }
    };
    c.paint(false);
    c.isRight = isRight;
    this.add(c);
    return c;
  }

  makeDegreePlate(i) {
    const V = this.local[i];
    const out = norm(sub(V, this.incentre));
    const p = add(V, mul(out, this.beam + 20));
    return this.makePlate(p, `${Math.round(this.degrees[i])}°`);
  }

  makePlate(p, label) {
    const c = this.scene.add.container(p.x, p.y);
    const fs = Math.max(this.cfg.minLabelPx ?? 15, Math.round(this.beam * 1.75));
    const t = this.scene.add.text(0, 0, label, {
      fontFamily: FONTS.display,
      fontSize: `${fs}px`,
      fontStyle: '700',
      color: toCss(COLORS.textDark),
    });
    t.setOrigin(0.5);
    const w = t.width + 14;
    const h = fs + 6;
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(-w / 2 + 1.5, -h / 2 + 2, w, h, 4);
    g.fillStyle(COLORS.panelPlate, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
    g.lineStyle(1.2, COLORS.panelPlateShade, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
    g.fillStyle(COLORS.boltShade, 1);
    g.fillCircle(-w / 2 + 4, 0, 1.6);
    g.fillCircle(w / 2 - 4, 0, 1.6);
    c.add([g, t]);
    c.text = t;
    this.add(c);
    return c;
  }

  /** Keep stamped labels upright whatever the frame's rotation. */
  syncLabels() {
    if (!this.active) return;
    let r = this.rotation;
    let p = this.parentContainer;
    while (p) {
      r += p.rotation;
      p = p.parentContainer;
    }
    for (const l of this.labels) if (l.visible) l.rotation = -r;
  }

  // ---------- states ----------

  setRim(alpha, duration = 160, color) {
    if (color != null) this.drawRim(color, color);
    else this.drawRim(COLORS.accentWarm, COLORS.selectCyan);
    stopTweensOf(this.scene, this.rim);
    this.scene.tweens.add({ targets: this.rim, alpha, duration, ease: 'Sine.easeOut' });
  }

  /** Short coloured outline flash (teal = installed). Never recolours the maths. */
  flashRim(color, hold = 380) {
    this.drawRim(color, color);
    stopTweensOf(this.scene, this.rim);
    this.rim.setAlpha(1);
    this.scene.tweens.add({ targets: this.rim, alpha: 0, delay: hold, duration: 520, ease: 'Sine.easeIn' });
  }

  /** Hint level 2: markings brighten (all frames, evenly). */
  setMarkingsLit(lit) {
    this.tickMarks.forEach((t) => t?.paint(lit));
    this.angleMarks.forEach((a) => a?.paint(lit));
  }

  /**
   * Hint level 3: stronger visual guidance without answering.
   *  'equalSides'   -> cyan bands along every pair of equal sides
   *  'largestAngle' -> cyan wedge on the largest angle, its reading enlarged
   */
  setGuide(mode) {
    const g = this.guide;
    g.clear();
    this.angleMarks.forEach((a) => a?.paint(false));
    this.labels.forEach((l) => l.setScale(1));
    if (mode === 'equalSides') {
      for (const i of this.equalEdges) {
        const a = this.local[i];
        const b = this.local[(i + 1) % 3];
        const ia = this.inner[i];
        const ib = this.inner[(i + 1) % 3];
        g.fillStyle(COLORS.selectCyan, 0.42);
        g.fillPoints([a, b, ib, ia], true);
      }
      this.tickMarks.forEach((t, i) => t?.paint(this.equalEdges.includes(i)));
    } else if (mode === 'largestAngle') {
      const i = this.largestAngleIndex;
      this.angleMarks[i]?.paint(true, true);
      this.labels[i]?.setScale(1.3);
    }
  }

  get largestAngleIndex() {
    let best = 0;
    this.degrees.forEach((d, i) => d > this.degrees[best] && (best = i));
    return best;
  }

  /** Pulse markings for a reinforcement/hint mode. Returns a promise. */
  pulseHighlight(mode, opts = {}) {
    if (mode === 'equalSides') return this.pulseEdges(this.equalEdges, opts);
    if (mode === 'allSides') return this.pulseEdges([0, 1, 2], opts);
    if (mode === 'allAngles') return this.pulseAngles([0, 1, 2], opts);
    if (mode === 'rightAngle') return this.pulseAngles(this.degrees.map((d, i) => (Math.abs(d - 90) < 0.25 ? i : -1)).filter((i) => i >= 0), opts);
    if (mode === 'largestAngle') return this.pulseAngles([this.largestAngleIndex], opts);
    return this.pulseAllMarkings(opts);
  }

  pulseEdges(indices, opts) {
    return this.pulse(indices.map((i) => this.tickMarks[i]), indices.map((i) => (this.cfg.markings === 'sides' ? this.labels[i] : null)), opts);
  }

  pulseAngles(indices, opts) {
    return this.pulse(indices.map((i) => this.angleMarks[i]), indices.map((i) => (this.cfg.markings === 'angles' ? this.labels[i] : null)), opts);
  }

  pulse(marks, plates, { repeat = 2, scale = 1.55, duration = 260 } = {}) {
    const targets = [...marks, ...plates.filter((p) => p && p.visible)].filter(Boolean);
    return new Promise((resolve) => {
      if (!targets.length) return resolve();
      marks.forEach((m) => m?.paint(true));
      this.scene.tweens.add({
        targets,
        scale,
        duration,
        yoyo: true,
        repeat,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          marks.forEach((m) => m?.paint(false));
          resolve();
        },
        onStop: resolve,
      });
    });
  }

  pulseAllMarkings(opts) {
    const all = [0, 1, 2];
    return this.cfg.markings === 'angles'
      ? this.pulseAngles(all, { repeat: 1, scale: 1.35, duration: 220, ...opts })
      : this.pulseEdges(all, { repeat: 1, scale: 1.35, duration: 220, ...opts });
  }

  setLabelsVisible(visible, duration = 250) {
    for (const p of this.labels) {
      if (visible) {
        p.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: p, alpha: 1, duration });
      } else if (p.visible) {
        this.scene.tweens.add({ targets: p, alpha: 0, duration, onComplete: () => p.setVisible(false) });
      }
    }
  }
}
