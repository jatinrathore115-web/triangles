// Cinematic title plate (checkpoints, final construction, "BRIDGE COMPLETE").

import { COLORS, DEPTH, FONTS, toCss } from '../config/theme.js';
import { tween, wait } from '../utils/async.js';
import { shade } from '../systems/ProceduralArt.js';
import { WordText } from './WordText.js';
import { Narrator } from '../systems/Narrator.js';

export function drawHazardPlate(g, w, h) {
  g.clear();
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 7, w, h, 12);
  g.fillStyle(COLORS.steelEdge, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  g.fillStyle(COLORS.panelNavy, 1);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 10);
  g.fillStyle(0xffffff, 0.05);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, (h - 8) * 0.45, { tl: 10, tr: 10, bl: 0, br: 0 });
  // hazard end caps
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -w / 2 + 4 : w / 2 - 22;
    g.fillStyle(COLORS.hazard, 1);
    g.fillRect(x0, -h / 2 + 4, 18, h - 8);
    g.fillStyle(COLORS.hazardDark, 1);
    for (let y = -h / 2 + 4; y < h / 2 - 4; y += 16) g.fillTriangle(x0, y + 8, x0 + 18, y, x0 + 18, y + 8);
  }
  g.lineStyle(2, shade(COLORS.accent, 0.1), 0.9);
  g.lineBetween(-w / 2 + 36, h / 2 - 10, w / 2 - 36, h / 2 - 10);
}

export class Banner {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(960, 150).setDepth(DEPTH.ui + 10).setVisible(false);
  }

  /** Shows the plate and speaks title + subtitle word by word. Resolves after the voice (and hold). */
  async show({ title, subtitle = '', y = 150, hold = 700, accent = COLORS.accentWarm, keep = false }) {
    const s = this.scene;
    this.root.removeAll(true);
    const parts = [{ text: title, style: { fontFamily: FONTS.display, fontSize: '54px', fontStyle: '700', color: toCss(COLORS.textLight) }, letterSpacing: 4 }];
    if (subtitle) parts.push({ text: subtitle, style: { fontFamily: FONTS.body, fontSize: '24px', fontStyle: '600', color: toCss(accent) }, gapBefore: -4 });
    const words = new WordText(s, 0, 0, parts, { align: 'center', maxWidth: 1400, lineHeight: 1.1, highlight: '#ffd27a' });
    words.y = -words.textHeight / 2;
    const w = words.textWidth + 140;
    const h = subtitle ? 124 : 92;
    const g = s.add.graphics();
    drawHazardPlate(g, w, h);
    this.root.add([g, words]);
    this.root.setPosition(960, y).setVisible(true).setAlpha(0).setScale(0.92);
    await tween(s, { targets: this.root, alpha: 1, scale: 1, duration: 360, ease: 'Back.easeOut' });
    await Narrator.say(words).done;
    if (keep) return;
    await wait(s, hold);
    await this.hide();
  }

  hide() {
    return tween(this.scene, { targets: this.root, alpha: 0, scale: 0.96, duration: 280, ease: 'Sine.easeIn' }).then(() => this.root.setVisible(false));
  }
}
