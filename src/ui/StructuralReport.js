// "STRUCTURAL REPORT": the end-of-mission recap, presented as an engineering spec sheet
// for the components the player installed. Each component shows its real markings
// (side ticks + lengths, or angle marks + degree readings) on a structural frame.

import { COLORS, DEPTH, FONTS, GAME_HEIGHT, GAME_WIDTH, toCss } from '../config/theme.js';
import { TRIANGLE_TYPES, REPORT_FRAMES, TRIANGLE_FRAMES, framePoints } from '../data/triangleFrames.js';
import { panelsForStage } from '../data/bridgeLayout.js';
import { TriangleFrame } from '../components/TriangleFrame.js';
import { PlateButton } from './PlateButton.js';
import { drawSteelPanel } from './plate.js';
import { tween, wait } from '../utils/async.js';
import { WordText } from './WordText.js';
import { Narrator } from '../systems/Narrator.js';
import { COPY, REPORT_ORDER } from '../data/narration.js';

const GROUPS = [
  { title: 'BY SIDES', sub: 'Classified by comparing side lengths', types: ['isosceles', 'equilateral', 'scalene'], markings: 'sides' },
  { title: 'BY ANGLES', sub: 'Classified by the size of the angles', types: ['acute', 'right', 'obtuse'], markings: 'angles' },
];

function star(g, x, y, r, filled) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillStyle(filled ? COLORS.accent : COLORS.panelNavyDeep, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, filled ? 0xfff0c0 : COLORS.steel, 1);
  g.strokePoints(pts, true, true);
}

export class StructuralReport {
  constructor(scene, { scoring, missionsTotal, onReplay, onViewBridge, audio }) {
    Object.assign(this, { scene, scoring, missionsTotal, onReplay, onViewBridge, audio });
  }

  show() {
    const s = this.scene;
    this.scrim = s.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.panelNavyDeep, 0.62).setOrigin(0).setDepth(DEPTH.overlay).setInteractive();
    const root = s.add.container(0, 0).setDepth(DEPTH.overlay + 1);
    this.root = root;

    const X = 70;
    const Y = 44;
    const W = GAME_WIDTH - 140;
    const H = GAME_HEIGHT - 88;
    const bg = s.add.graphics();
    drawSteelPanel(bg, W, H, { fill: 0x112236 });
    bg.setPosition(X, Y);
    // blueprint grid
    const grid = s.add.graphics();
    grid.lineStyle(1, 0x6fd8e6, 0.06);
    for (let x = X + 20; x < X + W - 20; x += 32) grid.lineBetween(x, Y + 20, x, Y + H - 20);
    for (let y = Y + 20; y < Y + H - 20; y += 32) grid.lineBetween(X + 20, y, X + W - 20, y);
    root.add([bg, grid]);

    const kicker = s.add.text(X + 56, Y + 40, 'SUNNYSIDE – RIVERDALE CROSSING  ·  TRUSS BRIDGE', { fontFamily: FONTS.display, fontSize: '20px', fontStyle: '700', color: toCss(COLORS.selectCyan) });
    kicker.setLetterSpacing?.(3);
    const title = new WordText(s, X + 52, Y + 64, [{ text: COPY.reportTitle, style: { fontFamily: FONTS.display, fontSize: '64px', fontStyle: '700', color: toCss(COLORS.textLight) } }], { highlight: '#ffd27a' });
    this.titleWords = title;
    this.items = {};
    root.add([kicker, title]);

    // rating block
    const stars = this.scoring.stars(this.missionsTotal);
    const sg = s.add.graphics();
    const rx = X + W - 520;
    for (let i = 0; i < 3; i++) star(sg, rx + 40 + i * 62, Y + 98, 24, i < stars);
    const rating = s.add.text(rx + 236, Y + 52, 'ENGINEERING RATING', { fontFamily: FONTS.display, fontSize: '19px', fontStyle: '700', color: toCss(COLORS.textMuted) });
    const pts = s.add.text(rx + 236, Y + 76, `${this.scoring.total} / ${this.scoring.maxFor(this.missionsTotal)} pts`, { fontFamily: FONTS.display, fontSize: '32px', fontStyle: '700', color: toCss(COLORS.accentWarm) });
    const first = s.add.text(rx + 236, Y + 116, `First-try installs: ${this.scoring.firstTryCount()} of ${this.missionsTotal}`, { fontFamily: FONTS.body, fontSize: '18px', color: toCss(COLORS.textMuted) });
    root.add([sg, rating, pts, first]);

    // two specification groups
    const gy = Y + 170;
    const gw = (W - 56 * 2 - 40) / 2;
    const gh = 650;
    GROUPS.forEach((grp, gi) => {
      const gx = X + 56 + gi * (gw + 40);
      const panel = s.add.graphics();
      panel.fillStyle(0x0c1a2b, 0.85);
      panel.fillRoundedRect(gx, gy, gw, gh, 12);
      panel.lineStyle(2, COLORS.steel, 0.9);
      panel.strokeRoundedRect(gx, gy, gw, gh, 12);
      panel.fillStyle(gi ? COLORS.selectCyan : COLORS.accent, 1);
      panel.fillRect(gx, gy + 18, 6, 44);
      const gt = s.add.text(gx + 26, gy + 16, grp.title, { fontFamily: FONTS.display, fontSize: '34px', fontStyle: '700', color: toCss(COLORS.textLight) });
      gt.setLetterSpacing?.(3);
      const gs = s.add.text(gx + 26, gy + 56, grp.sub, { fontFamily: FONTS.body, fontSize: '19px', color: toCss(COLORS.textMuted) });
      root.add([panel, gt, gs]);
      const cw = (gw - 40) / 3;
      grp.types.forEach((type, ti) => this.component(root, type, grp.markings, gx + 20 + ti * cw, gy + 100, cw - 14, gh - 120, gi * 3 + ti));
    });

    // actions
    const replay = new PlateButton(s, { x: X + W - 56 - 150, y: Y + H - 62, width: 300, height: 64, label: 'BUILD AGAIN', onPress: () => this.onReplay?.(), audio: this.audio });
    const view = new PlateButton(s, { x: X + W - 56 - 470, y: Y + H - 62, width: 300, height: 64, label: 'VIEW BRIDGE', color: 0x93a3b2, onPress: () => this.toggle(), audio: this.audio });
    root.add([replay.root, view.root]);
    this.buttons = { replay, view };

    root.alpha = 0;
    this.scrim.alpha = 0;
    tween(s, { targets: this.scrim, alpha: 1, duration: 400 });
    return tween(s, { targets: root, alpha: 1, duration: 500, ease: 'Cubic.easeOut' }).then(() => {
      this.narration = this.narrateAll();
    });
  }

  component(root, type, markings, x, y, w, h, index) {
    const s = this.scene;
    const info = TRIANGLE_TYPES[type];
    const g = s.add.graphics();
    g.fillStyle(0x15283d, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1.5, 0x3a5068, 1);
    g.strokeRoundedRect(x, y, w, h, 10);
    // component header strip
    g.fillStyle(0x0d1b2b, 1);
    g.fillRoundedRect(x, y, w, 40, { tl: 10, tr: 10, bl: 0, br: 0 });
    const code = s.add.text(x + 16, y + 9, `${info.code}-0${index + 1}`, { fontFamily: FONTS.display, fontSize: '21px', fontStyle: '700', color: toCss(COLORS.selectCyan) });
    code.setLetterSpacing?.(2);
    const stamp = s.add.text(x + w - 16, y + 11, 'VERIFIED', { fontFamily: FONTS.display, fontSize: '16px', fontStyle: '700', color: toCss(COLORS.correctTeal) }).setOrigin(1, 0);
    stamp.setLetterSpacing?.(2);
    root.add([g, code, stamp]);

    // the structural component itself, with its real markings
    const def = TRIANGLE_FRAMES[REPORT_FRAMES[type]];
    const pts = framePoints(def);
    const probe = new TriangleFrame(s, { points: pts, pxPerMetre: 1, markings: 'none' });
    const box = { w: markings === 'angles' ? w - 104 : w - 84, h: 200 };
    const S = Math.min(box.w / probe.widthPx, box.h / probe.heightPx);
    probe.destroy();
    const f = new TriangleFrame(s, { points: pts, pxPerMetre: S, markings, showLabels: true, minLabelPx: 20, material: def.material, seed: index * 7 + 3, id: def.id });
    const ys = f.local.map((v) => v.y);
    const xs = f.local.map((v) => v.x);
    f.setPosition(x + w / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, y + 60 + box.h + 14 - Math.max(...ys));
    root.add(f);

    // dimension line under the component (blueprint flavour)
    const dim = s.add.graphics();
    const dy = y + 60 + box.h + 50;
    dim.lineStyle(1.2, COLORS.selectCyan, 0.45);
    dim.lineBetween(x + 24, dy, x + w - 24, dy);
    dim.lineBetween(x + 24, dy - 6, x + 24, dy + 6);
    dim.lineBetween(x + w - 24, dy - 6, x + w - 24, dy + 6);
    root.add(dim);

    // name + spec: one narrated line, revealed as it is spoken
    const words = new WordText(
      s,
      x + 18,
      dy + 18,
      [
        { text: info.short, style: { fontFamily: FONTS.display, fontSize: '36px', fontStyle: '700', color: toCss(COLORS.textLight) } },
        { text: info.spec, style: { fontFamily: FONTS.body, fontSize: '22px', fontStyle: '700', color: toCss(COLORS.accentWarm) }, gapBefore: 2 },
      ],
      { maxWidth: w - 36, lineHeight: 1.18, highlight: '#ffd27a' },
    );
    this.items[type] = { frame: f, words };
    const units = panelsForStage(type).length;
    const meta = s.add.text(x + 18, y + h - 34, `Installed on bridge: ${units} unit${units === 1 ? '' : 's'}`, { fontFamily: FONTS.body, fontSize: '17px', color: toCss(COLORS.textMuted) });
    root.add([words, meta]);
  }

  /** Spoken recap: the title, then each component while its defining markings pulse. */
  async narrateAll() {
    await Narrator.say(this.titleWords).done;
    for (const type of REPORT_ORDER) {
      if (!this.root?.active) return;
      const it = this.items[type];
      await wait(this.scene, 150);
      it.frame.pulseHighlight(this.highlightFor(type), { repeat: 1, scale: 1.4, duration: 240 });
      await Narrator.say(it.words).done;
    }
  }

  highlightFor(type) {
    return { isosceles: 'equalSides', equilateral: 'equalSides', scalene: 'allSides', acute: 'allAngles', right: 'rightAngle', obtuse: 'largestAngle' }[type];
  }

  /** Hide the report to admire the bridge; a small button brings it back. */
  toggle() {
    const s = this.scene;
    if (this.hidden) return;
    this.hidden = true;
    tween(s, { targets: [this.root, this.scrim], alpha: 0, duration: 300 }).then(() => {
      this.root.setVisible(false);
      this.scrim.disableInteractive();
    });
    this.back = new PlateButton(s, { x: GAME_WIDTH - 200, y: GAME_HEIGHT - 60, width: 320, height: 60, label: 'STRUCTURAL REPORT', onPress: () => this.restore(), audio: this.audio });
    this.back.root.setDepth(DEPTH.overlay + 2);
  }

  restore() {
    this.back?.root.destroy();
    this.back = null;
    this.hidden = false;
    this.root.setVisible(true);
    this.scrim.setInteractive();
    tween(this.scene, { targets: [this.root, this.scrim], alpha: 1, duration: 300 });
  }
}
