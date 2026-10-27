// Visual bridge: piers, deck girder, built truss panels, the active construction slot and
// the finishing details added by the final construction sequence.
// The superstructure lives in one container pivoting on the central pier so that a rejected
// frame can make the whole span sway while the piers stay planted.

import Phaser from 'phaser';
import { COLORS, DEPTH } from '../config/theme.js';
import { BRIDGE, PANELS, LAMPS, TOP_CHORD, STAGE_SIDE_TYPES, toScreen, panelById, panelsForStage, connectorsForStage } from '../data/bridgeLayout.js';
import { TriangleFrame } from './TriangleFrame.js';
import { shade } from '../systems/ProceduralArt.js';
import { tween, wait, stopTweensOf } from '../utils/async.js';

const PIVOT = { x: BRIDGE.originX + BRIDGE.pillars[0].x * BRIDGE.pxPerMetre, y: BRIDGE.deckY + BRIDGE.deckThickness };
const ROAD_Y = BRIDGE.deckY - 4; // top of the driving surface (screen px)

const markingsForStage = (stage) => (STAGE_SIDE_TYPES.includes(stage) ? 'sides' : 'angles');

export class BridgeView {
  constructor(scene) {
    this.scene = scene;
    this.panels = new Map(); // panelId -> TriangleFrame
    this.drawPiers();
    this.drawApproaches();

    this.root = scene.add.container(PIVOT.x, PIVOT.y).setDepth(DEPTH.bridge);
    this.deck = scene.add.graphics();
    this.chords = scene.add.container(0, 0);
    this.truss = scene.add.container(0, 0);
    this.details = scene.add.container(0, 0);
    this.slotLayer = scene.add.container(0, 0);
    this.props = scene.add.container(0, 0);
    this.root.add([this.deck, this.chords, this.truss, this.details, this.props, this.slotLayer]);
    this.drawDeck();
    this.drawDeckProps();
  }

  /** Convert a bridge-metre point to root-local px. */
  local(p) {
    const s = toScreen(p);
    return { x: s.x - PIVOT.x, y: s.y - PIVOT.y };
  }

  // ---------- static structure ----------

  drawPiers() {
    const s = this.scene;
    for (const p of BRIDGE.pillars) {
      const x = BRIDGE.originX + p.x * BRIDGE.pxPerMetre;
      s.add.image(x, BRIDGE.deckY + BRIDGE.deckThickness - 4, 'bridge.pillar').setOrigin(0.5, 0).setDepth(DEPTH.bridgeBack);
    }
    const left = toScreen({ x: 0, y: 0 });
    const right = toScreen({ x: BRIDGE.span, y: 0 });
    s.add.image(left.x + 16, left.y + BRIDGE.deckThickness - 6, 'bridge.abutment.left').setOrigin(1, 0).setDepth(DEPTH.bridgeBack);
    s.add.image(right.x - 16, right.y + BRIDGE.deckThickness - 6, 'bridge.abutment.right').setOrigin(0, 0).setDepth(DEPTH.bridgeBack);
  }

  /** Gravel approach embankments on both banks; asphalt is laid in the final sequence. */
  drawApproaches() {
    const s = this.scene;
    const g = s.add.graphics().setDepth(DEPTH.bankFar + 2);
    const L = toScreen({ x: 0, y: 0 }).x;
    const R = toScreen({ x: BRIDGE.span, y: 0 }).x;
    const bank = (x0, x1, groundY) => {
      g.fillStyle(COLORS.dirtShade, 1);
      g.fillPoints([{ x: x0, y: ROAD_Y + 6 }, { x: x1, y: ROAD_Y + 6 }, { x: x1, y: groundY + 6 }, { x: x0, y: groundY + 6 }], true);
      g.fillStyle(shade(COLORS.dirt, 0.08), 1);
      g.fillRect(Math.min(x0, x1), ROAD_Y, Math.abs(x1 - x0), 7);
      g.fillStyle(0x000000, 0.12);
      g.fillRect(Math.min(x0, x1), ROAD_Y + 7, Math.abs(x1 - x0), 3);
    };
    bank(0, L - 2, 612);
    bank(R + 2, 1920, 622);
    this.asphalt = s.add.graphics().setDepth(DEPTH.bankFar + 3).setAlpha(0);
    for (const [x0, x1] of [
      [0, L],
      [R, 1920],
    ]) {
      this.asphalt.fillStyle(0x3b4148, 1);
      this.asphalt.fillRect(x0, ROAD_Y - 1, x1 - x0, 7);
      this.asphalt.fillStyle(0x59616b, 1);
      this.asphalt.fillRect(x0, ROAD_Y - 1, x1 - x0, 2);
    }
  }

  drawDeck() {
    const g = this.deck;
    const a = this.local({ x: -0.6, y: 0 });
    const b = this.local({ x: BRIDGE.span + 0.6, y: 0 });
    const T = BRIDGE.deckThickness;
    const D = BRIDGE.girderDepth;
    const w = b.x - a.x;
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillRect(a.x - 2, a.y - 6, w + 4, T + D + 8);
    g.fillStyle(shade(COLORS.concrete, -0.05), 1);
    g.fillRect(a.x, a.y - 4, w, 8);
    g.fillStyle(shade(COLORS.concrete, 0.18), 1);
    g.fillRect(a.x, a.y - 4, w, 2);
    g.fillStyle(COLORS.steel, 1);
    g.fillRect(a.x, a.y + 4, w, T - 6);
    g.fillStyle(shade(COLORS.steel, 0.22), 1);
    g.fillRect(a.x, a.y + 4, w, 3);
    g.fillStyle(COLORS.steelDark, 1);
    g.fillRect(a.x + 10, a.y + T - 2, w - 20, D);
    g.fillStyle(shade(COLORS.steelDark, 0.25), 1);
    g.fillRect(a.x + 10, a.y + T - 2, w - 20, 2);
    for (let m = 1; m < BRIDGE.span; m += 2) {
      const p = this.local({ x: m, y: 0 });
      g.fillStyle(shade(COLORS.steel, -0.16), 1);
      g.fillRect(p.x - 1.5, a.y + 8, 3, T - 10);
      g.fillStyle(shade(COLORS.steelDark, -0.2), 1);
      g.fillRect(p.x - 1.5, a.y + T, 3, D - 4);
    }
    for (let m = 0.5; m < BRIDGE.span; m += 1) {
      const p = this.local({ x: m, y: 0 });
      g.fillStyle(shade(COLORS.steel, 0.35), 1);
      g.fillCircle(p.x, a.y + 12, 1.6);
    }
    g.fillStyle(0x000000, 0.12);
    g.fillRect(a.x + 10, a.y + T + D - 2, w - 20, 6);
  }

  drawDeckProps() {
    const s = this.scene;
    const add = (key, mx, dy = 0, scale = 1) => {
      const p = this.local({ x: mx, y: 0 });
      const img = s.add.image(p.x, p.y - 3 + dy, key).setOrigin(0.5, 1).setScale(scale);
      this.props.add(img);
      return img;
    };
    // temporary timber scaffold towers (never over a slot opening: no shape hints)
    for (const [mx, levels] of [
      [16.4, 2],
      [27.4, 4],
      [44.2, 2],
    ]) {
      this.props.add(this.makeScaffold(mx, levels));
    }
    this.tempRail = this.makeRailing(20, COLORS.steelDark, 0.85);
    this.props.add(this.tempRail);
    add('prop.cone', 30.6, 0, 0.62);
    add('prop.cone', 31.8, 0, 0.62);
    add('prop.barrier', 45.2, 0, 0.7);
    add('prop.beams', 21.2, 0, 0.55);
  }

  makeScaffold(mx, levels) {
    const p = this.local({ x: mx, y: 0 });
    const g = this.scene.add.graphics({ x: p.x, y: p.y - 4 });
    const w = 46;
    const lh = 30;
    const H = levels * lh;
    const post = (x) => {
      g.fillStyle(COLORS.timberShade, 1);
      g.fillRect(x - 3, -H, 6, H);
      g.fillStyle(shade(COLORS.timber, 0.15), 1);
      g.fillRect(x - 3, -H, 2, H);
    };
    g.lineStyle(3, shade(COLORS.timberShade, -0.1), 0.9);
    for (let k = 0; k < levels; k++) {
      const y0 = -k * lh;
      g.lineBetween(-w / 2, y0, w / 2, y0 - lh);
      g.lineBetween(w / 2, y0, -w / 2, y0 - lh);
    }
    post(-w / 2);
    post(w / 2);
    for (let k = 1; k <= levels; k++) {
      const y = -k * lh;
      g.fillStyle(COLORS.timber, 1);
      g.fillRect(-w / 2 - 8, y - 4, w + 16, 6);
      g.fillStyle(shade(COLORS.timber, 0.2), 1);
      g.fillRect(-w / 2 - 8, y - 4, w + 16, 2);
    }
    g.setAlpha(0.92);
    return g;
  }

  makeRailing(h, color, alpha) {
    const g = this.scene.add.graphics();
    const a = this.local({ x: 0.3, y: 0 });
    const b = this.local({ x: BRIDGE.span - 0.3, y: 0 });
    for (let m = 0.3; m <= BRIDGE.span - 0.3; m += 1.5) {
      const p = this.local({ x: m, y: 0 });
      g.fillStyle(color, alpha);
      g.fillRect(p.x - 1.5, p.y - h - 4, 3, h);
    }
    g.lineStyle(3, color, alpha);
    g.lineBetween(a.x, a.y - h - 4, b.x, b.y - h - 4);
    g.lineStyle(1.2, COLORS.steelLight, 0.6);
    g.lineBetween(a.x, a.y - h - 5, b.x, b.y - h - 5);
    return g;
  }

  // ---------- slot ----------

  showSlot(panelId) {
    const panel = panelById(panelId);
    this.slotPanel = panel;
    this.slotLayer.removeAll(true);
    this.slotIdle?.stop();
    const A = this.local(panel.points[0]);
    const B = this.local(panel.points[1]);
    const onDeck = Math.abs(panel.points[0].y) < 0.01 && Math.abs(panel.points[1].y) < 0.01;
    const edgeMid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    const C = panel.points.map((p) => this.local(p));
    const centroid = { x: (C[0].x + C[1].x + C[2].x) / 3, y: (C[0].y + C[1].y + C[2].y) / 3 };
    // deck slots point at the deck connection; elevated slots point into the opening
    const marker = onDeck ? { x: edgeMid.x, y: edgeMid.y - 36 } : centroid;
    const edgeLen = Math.hypot(B.x - A.x, B.y - A.y);
    const ang = Math.atan2(B.y - A.y, B.x - A.x);

    const glow = this.scene.add.image(onDeck ? edgeMid.x : centroid.x, onDeck ? edgeMid.y - 10 : centroid.y, 'fx.glow').setBlendMode(Phaser.BlendModes.ADD);
    glow.setDisplaySize(onDeck ? edgeLen * 1.9 : edgeLen * 1.2, onDeck ? 120 : edgeLen * 0.9).setAlpha(0.25).setTint(0xfff0c8);

    // dashed connection marking along the slot's anchoring edge (where, never the shape)
    const g = this.scene.add.graphics({ x: A.x, y: A.y });
    g.setRotation(ang);
    for (let x = 6; x < edgeLen - 6; x += 24) {
      g.fillStyle(COLORS.hazard, 1);
      g.fillRect(x, onDeck ? -7 : -2, Math.min(12, edgeLen - 6 - x), 4);
    }
    const anchors = [A, B].map((p) => {
      const c = this.scene.add.container(p.x, p.y);
      const a = this.scene.add.graphics();
      a.fillStyle(COLORS.steelEdge, 1);
      a.fillRoundedRect(-13, -16, 26, 16, 3);
      a.fillStyle(shade(COLORS.steel, 0.12), 1);
      a.fillRoundedRect(-11, -14, 22, 12, 2);
      if (!onDeck) a.setPosition(0, 8);
      const light = this.scene.add.graphics();
      if (!onDeck) light.setPosition(0, 8);
      c.add([a, light]);
      c.light = light;
      c.paintLight = (color, r = 2.6) => {
        light.clear();
        light.fillStyle(color, 1);
        light.fillCircle(-5, -8, r);
        light.fillCircle(5, -8, r);
      };
      c.paintLight(COLORS.glowWarm);
      return c;
    });

    const chevron = this.scene.add.graphics({ x: marker.x, y: marker.y });
    chevron.fillStyle(COLORS.steelEdge, 0.9);
    chevron.fillTriangle(-15, -12, 15, -12, 0, 6);
    chevron.fillStyle(COLORS.accent, 1);
    chevron.fillTriangle(-11, -10, 11, -10, 0, 3);
    chevron.lineStyle(2, COLORS.selectCyan, 0.9);
    chevron.strokeTriangle(-11, -10, 11, -10, 0, 3);
    chevron.setAlpha(0);

    this.slotLayer.add([glow, g, ...anchors, chevron]);
    this.slot = { glow, marking: g, anchors, chevron, marker, glowSize: [glow.displayWidth, glow.displayHeight] };
    this.slotIdle = this.scene.tweens.add({ targets: glow, alpha: { from: 0.18, to: 0.4 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Soft cyan/gold pulse once a frame is selected. */
  setSlotActive(active) {
    if (!this.slot) return;
    const { chevron, glow, anchors, marker } = this.slot;
    stopTweensOf(this.scene, chevron);
    if (active) {
      chevron.y = marker.y - 10;
      glow.setTint(0xc8f4ff);
      this.scene.tweens.add({ targets: chevron, alpha: 1, duration: 200 });
      this.scene.tweens.add({ targets: chevron, y: marker.y, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.scene.tweens.add({ targets: glow, scaleY: glow.scaleY * 1.2, duration: 260, ease: 'Sine.easeOut' });
      anchors.forEach((a) => this.scene.tweens.add({ targets: a.light, alpha: { from: 0.4, to: 1 }, duration: 500, yoyo: true, repeat: -1 }));
    } else {
      this.scene.tweens.add({ targets: chevron, alpha: 0, duration: 160 });
      glow.setTint(0xfff0c8);
      glow.setDisplaySize(...this.slot.glowSize);
      anchors.forEach((a) => {
        stopTweensOf(this.scene, a.light);
        a.light.setAlpha(1);
      });
    }
  }

  slotWorld() {
    const p = this.slotPanel.points;
    const apex = p.reduce((t, v) => (v.y > t.y ? v : t), p[0]);
    const m = this.slot?.marker ?? this.local(p[0]);
    return { apex: toScreen(apex), marker: { x: m.x + PIVOT.x, y: m.y + PIVOT.y } };
  }

  hideSlot() {
    if (!this.slot) return;
    this.slotIdle?.stop();
    const items = this.slotLayer.list.slice();
    this.scene.tweens.add({ targets: items, alpha: 0, duration: 220, onComplete: () => this.slotLayer.removeAll(true) });
    this.slot = null;
  }

  /** Connection point refuses a frame: anchors flash amber/red, the marking jolts. */
  rejectFlash() {
    if (!this.slot) return;
    const { anchors, marking } = this.slot;
    anchors.forEach((a) => {
      a.paintLight(COLORS.incorrectRed, 3.2);
      this.scene.time.delayedCall(260, () => a.paintLight(COLORS.warn, 3));
      this.scene.time.delayedCall(800, () => a.paintLight(COLORS.glowWarm));
    });
    this.scene.tweens.add({ targets: marking, alpha: 0.3, duration: 90, yoyo: true, repeat: 3 });
  }

  // ---------- motion ----------

  wobble({ amplitudeDeg = 0.85, duration = 950 } = {}) {
    const state = { t: 0 };
    const amp = Phaser.Math.DegToRad(amplitudeDeg);
    return tween(this.scene, {
      targets: state,
      t: 1,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        const t = state.t;
        const env = Math.exp(-4.2 * t) * (1 - Math.exp(-40 * t));
        this.root.rotation = amp * Math.sin(t * Math.PI * 7) * env;
        this.root.x = PIVOT.x + Math.sin(t * Math.PI * 9) * 4 * env;
      },
      onComplete: () => {
        this.root.rotation = 0;
        this.root.x = PIVOT.x;
      },
    });
  }

  /** Tiny elastic deflection under a vehicle load (0..1 = position along the span). */
  setLoad(t) {
    const onSpan = t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0;
    this.root.y = PIVOT.y + onSpan * 1.6;
  }

  // ---------- building ----------

  /** Take ownership of the frame the crane delivered (world coords -> bridge root). */
  adoptFrame(frame, panelId, scale = 1) {
    const panel = panelById(panelId);
    const m = this.local({ x: (panel.points[0].x + panel.points[1].x) / 2, y: (panel.points[0].y + panel.points[1].y) / 2 });
    frame.carryRot = 0;
    frame.setRotation(0).setScale(scale).setPosition(m.x, m.y);
    this.truss.add(frame);
    this.panels.set(panelId, frame);
  }

  makePanelFrame(panel) {
    const f = new TriangleFrame(this.scene, {
      points: panel.points,
      pxPerMetre: BRIDGE.pxPerMetre,
      material: 'steel',
      markings: markingsForStage(panel.stage),
      showLabels: false,
      seed: panel.id.length * 31,
      id: panel.id,
    });
    const m = this.local({ x: (panel.points[0].x + panel.points[1].x) / 2, y: (panel.points[0].y + panel.points[1].y) / 2 });
    f.setPosition(m.x, m.y);
    return f;
  }

  /** Restore an already-completed stage with no animation (scene restarts keep progress). */
  buildInstant(stage) {
    for (const panel of panelsForStage(stage)) {
      if (this.panels.has(panel.id)) continue;
      const f = this.makePanelFrame(panel);
      this.truss.add(f);
      this.panels.set(panel.id, f);
    }
    connectorsForStage(stage).forEach((c) => this.growChord(c, 0, true));
  }

  /** Assemble every other panel + connector of a stage (the placed one is already there). */
  async assembleStage(stage, { except = [], fx } = {}) {
    const jobs = [];
    connectorsForStage(stage).forEach((c, i) => jobs.push(this.growChord(c, i * 90)));
    const others = panelsForStage(stage).filter((p) => !except.includes(p.id));
    others.forEach((panel, i) => {
      const f = this.makePanelFrame(panel);
      this.truss.add(f);
      this.panels.set(panel.id, f);
      f.setAlpha(0);
      const ty = f.y;
      f.y = ty - 70;
      f.lockBolts.forEach((b) => b.setScale(0));
      jobs.push(
        (async () => {
          await wait(this.scene, 140 + i * 160);
          await tween(this.scene, { targets: f, alpha: 1, y: ty, duration: 340, ease: 'Back.easeOut' });
          fx?.onPanelLanded?.(f, panel);
          await this.lockBolts(f, fx);
        })(),
      );
    });
    await Promise.all(jobs);
  }

  async lockBolts(frame, fx) {
    for (const b of frame.lockBolts) {
      b.setScale(0);
      b.setAngle(-90);
    }
    for (const b of frame.lockBolts) {
      fx?.onBolt?.(frame, b);
      this.scene.tweens.add({ targets: b, scale: 1, angle: 0, duration: 180, ease: 'Back.easeOut' });
      await wait(this.scene, 85);
    }
    await wait(this.scene, 120);
  }

  growChord(c, delay, instant = false) {
    const a = this.local(c.from);
    const b = this.local(c.to);
    const g = this.scene.add.graphics({ x: a.x, y: a.y });
    const w = b.x - a.x;
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillRect(0, -10, w, 10);
    g.fillStyle(shade(COLORS.steel, 0.1), 1);
    g.fillRect(1, -9, w - 2, 7);
    g.fillStyle(shade(COLORS.steel, 0.38), 1);
    g.fillRect(1, -9, w - 2, 2);
    for (let x = 8; x < w - 4; x += 16) {
      g.fillStyle(COLORS.bolt, 1);
      g.fillCircle(x, -5, 1.8);
    }
    this.chords.add(g);
    if (instant) return Promise.resolve();
    g.scaleX = 0;
    return tween(this.scene, { targets: g, scaleX: 1, duration: 420, delay, ease: 'Cubic.easeOut' });
  }

  /** Warm construction glow washing over freshly built panels. */
  glowPanels(panelIds, { tint = 0xffffff, peak = 0.75 } = {}) {
    const imgs = panelIds
      .map((id) => this.panels.get(id))
      .filter(Boolean)
      .map((f) => {
        const pts = f.local;
        const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
        const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
        const img = this.scene.add.image(f.x + cx * f.scaleX, f.y + cy * f.scaleY, 'fx.glow').setBlendMode(Phaser.BlendModes.ADD).setTint(tint);
        img.setDisplaySize(f.widthPx * f.scaleX * 2, f.heightPx * f.scaleY * 1.8).setAlpha(0);
        this.root.add(img);
        return img;
      });
    if (!imgs.length) return Promise.resolve();
    return tween(this.scene, {
      targets: imgs,
      alpha: { from: 0, to: peak },
      duration: 320,
      yoyo: true,
      hold: 260,
      ease: 'Sine.easeInOut',
      onComplete: () => imgs.forEach((i) => i.destroy()),
    });
  }

  /** Points of interest for the checkpoint labels (world px). */
  panelTopWorld(panelId) {
    const p = panelById(panelId).points;
    const top = p.reduce((t, v) => (v.y > t.y ? v : t), p[0]);
    return toScreen(top);
  }

  panelBottomWorld(panelId) {
    const p = panelById(panelId).points;
    const cx = (p[0].x + p[1].x + p[2].x) / 3;
    return toScreen({ x: cx, y: 0 });
  }

  // ---------- final construction sequence ----------

  framesLeftToRight() {
    return [...this.panels.values()].sort((a, b) => a.x - b.x);
  }

  /** Sequential bolt connection travelling along the span. */
  async boltWave({ onBolt } = {}) {
    let k = 0;
    for (const f of this.framesLeftToRight()) {
      for (const b of f.lockBolts) {
        const idx = k++;
        this.scene.time.delayedCall(idx * 26, () => {
          this.scene.tweens.add({ targets: b, scale: { from: 1.7, to: 1 }, angle: { from: -60, to: 0 }, duration: 220, ease: 'Back.easeOut' });
          onBolt?.(f, b, idx);
        });
      }
    }
    await wait(this.scene, k * 26 + 260);
  }

  /** Beams "activate": a teal flash travels across every member. */
  async beamWave() {
    const frames = this.framesLeftToRight();
    frames.forEach((f, i) => this.scene.time.delayedCall(i * 70, () => f.flashRim(COLORS.correctTeal, 200)));
    await wait(this.scene, frames.length * 70 + 200);
    await this.glowPanels(PANELS.map((p) => p.id), { tint: 0xfff2d0, peak: 0.45 });
  }

  /** Construction props leave the deck. */
  clearProps() {
    const items = this.props.list.slice();
    return tween(this.scene, {
      targets: items,
      alpha: 0,
      y: '-=18',
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => this.props.removeAll(true),
    });
  }

  /** Driving surface laid left -> right (also on the approach roads). */
  async layDeck(duration = 1300) {
    const a = this.local({ x: 0, y: 0 });
    const b = this.local({ x: BRIDGE.span, y: 0 });
    const g = this.scene.add.graphics({ x: a.x, y: a.y });
    const w = b.x - a.x;
    g.fillStyle(0x3b4148, 1);
    g.fillRect(0, -9, w, 7);
    g.fillStyle(0x59616b, 1);
    g.fillRect(0, -9, w, 2);
    // kerb with reflectors
    for (let x = 12; x < w; x += 50) {
      g.fillStyle(COLORS.hazard, 1);
      g.fillRect(x, -4, 10, 2);
    }
    g.scaleX = 0;
    this.details.add(g);
    this.scene.tweens.add({ targets: this.asphalt, alpha: 1, duration: duration * 0.6 });
    await tween(this.scene, { targets: g, scaleX: 1, duration, ease: 'Sine.easeInOut' });
  }

  /** Permanent safety rails replace the temporary rail, post by post. */
  async installRails() {
    stopTweensOf(this.scene, this.tempRail);
    const posts = [];
    const h = 26;
    for (let m = 0.3; m <= BRIDGE.span - 0.3; m += 1.5) {
      const p = this.local({ x: m, y: 0 });
      const post = this.scene.add.graphics({ x: p.x, y: p.y - 6 });
      post.fillStyle(COLORS.steelEdge, 1);
      post.fillRect(-2.5, -h, 5, h);
      post.fillStyle(COLORS.craneYellow, 1);
      post.fillRect(-2.5, -h, 5, 4);
      post.scaleY = 0;
      this.details.add(post);
      posts.push(post);
    }
    posts.forEach((p, i) => this.scene.tweens.add({ targets: p, scaleY: 1, duration: 200, delay: i * 18, ease: 'Back.easeOut' }));
    await wait(this.scene, posts.length * 18 + 200);
    const a = this.local({ x: 0.3, y: 0 });
    const b = this.local({ x: BRIDGE.span - 0.3, y: 0 });
    const rail = this.scene.add.graphics({ x: a.x, y: a.y - 6 - h });
    rail.fillStyle(COLORS.steelEdge, 1);
    rail.fillRect(0, -2, b.x - a.x, 6);
    rail.fillStyle(COLORS.steelLight, 1);
    rail.fillRect(0, -2, b.x - a.x, 2);
    rail.fillStyle(COLORS.steel, 1);
    rail.fillRect(0, 10, b.x - a.x, 3);
    rail.scaleX = 0;
    this.details.add(rail);
    this.tempRail?.setVisible(false);
    await tween(this.scene, { targets: rail, scaleX: 1, duration: 700, ease: 'Cubic.easeOut' });
  }

  /** Lamp posts rise; lights switch on when the site reaches its completion state. */
  async installLamps() {
    this.lamps = LAMPS.map((mx, i) => {
      const p = this.local({ x: mx, y: 0 });
      const c = this.scene.add.container(p.x, p.y - 6);
      const g = this.scene.add.graphics();
      g.fillStyle(COLORS.steelEdge, 1);
      g.fillRect(-2.5, -78, 5, 78);
      g.fillRect(-2.5, -80, 16, 4);
      g.fillStyle(COLORS.steelDark, 1);
      g.fillRoundedRect(8, -82, 12, 8, 2);
      const glow = this.scene.add.image(14, -72, 'fx.glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.32).setTint(COLORS.lampWarm).setAlpha(0);
      const bulb = this.scene.add.circle(14, -74, 3, COLORS.lampWarm).setAlpha(0.25);
      c.add([g, glow, bulb]);
      c.glow = glow;
      c.bulb = bulb;
      c.scaleY = 0;
      this.details.add(c);
      this.scene.tweens.add({ targets: c, scaleY: 1, duration: 300, delay: i * 80, ease: 'Back.easeOut' });
      return c;
    });
    await wait(this.scene, LAMPS.length * 80 + 300);
  }

  switchOnLamps() {
    (this.lamps ?? []).forEach((l, i) => {
      this.scene.tweens.add({ targets: l.glow, alpha: 0.9, duration: 260, delay: i * 120 });
      this.scene.tweens.add({ targets: l.bulb, alpha: 1, duration: 200, delay: i * 120 });
    });
  }

  /** Triangular bunting strung along the top chord for the opening. */
  async hangBunting() {
    const colors = [0x3ec3a3, COLORS.accent, 0x5b8fd6, 0xe8743b, 0xf3ead8];
    const g = this.scene.add.graphics();
    let k = 0;
    for (let i = 0; i < TOP_CHORD.length - 1; i++) {
      const a = this.local(TOP_CHORD[i]);
      const b = this.local(TOP_CHORD[i + 1]);
      const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 26));
      g.lineStyle(1.5, 0x2a2f36, 0.9);
      g.beginPath();
      for (let s = 0; s <= 20; s++) {
        const t = s / 20;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 14 + 6;
        s ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokePath();
      for (let s = 1; s < n; s++) {
        const t = s / n;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 14 + 6;
        g.fillStyle(colors[k++ % colors.length], 1);
        g.fillTriangle(x - 7, y, x + 7, y, x, y + 14);
      }
    }
    g.setAlpha(0);
    this.details.add(g);
    await tween(this.scene, { targets: g, alpha: 1, duration: 500 });
  }

  /** Fade every placed frame's stamped labels so the finished bridge reads clean. */
  hideAllLabels() {
    this.panels.forEach((f) => f.setLabelsVisible(false));
  }

  get roadY() {
    return ROAD_Y;
  }
}
