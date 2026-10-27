// Top-right "BRIDGE PROGRESS" plate: counter + one bolt socket per mission.

import { COLORS, DEPTH, FONTS, toCss } from '../config/theme.js';
import { drawSteelPanel } from './plate.js';
import { tween, wait } from '../utils/async.js';

const W = 300;
const H = 132;

export class ProgressPanel {
  constructor(scene, { total, completed = 0, right = 1888, y = 16 }) {
    this.scene = scene;
    this.total = total;
    this.completed = completed;
    this.home = { x: right - W, y };
    this.root = scene.add.container(this.home.x, y).setDepth(DEPTH.ui);
    const bg = scene.add.graphics();
    drawSteelPanel(bg, W, H);
    const title = scene.add.text(W / 2, 22, 'BRIDGE PROGRESS', {
      fontFamily: FONTS.display,
      fontSize: '21px',
      fontStyle: '700',
      color: toCss(COLORS.textMuted),
    });
    title.setOrigin(0.5, 0).setLetterSpacing?.(2);
    this.count = scene.add.text(W / 2, 46, '', {
      fontFamily: FONTS.display,
      fontSize: '42px',
      fontStyle: '700',
      color: toCss(COLORS.textLight),
    });
    this.count.setOrigin(0.5, 0);
    this.root.add([bg, title, this.count]);

    this.sockets = [];
    const gap = 38;
    const x0 = W / 2 - ((total - 1) * gap) / 2;
    for (let i = 0; i < total; i++) {
      const s = scene.add.graphics({ x: x0 + i * gap, y: 108 });
      this.root.add(s);
      this.sockets.push(s);
      this.drawSocket(s, i < completed);
    }
    this.renderCount(completed);
  }

  drawSocket(g, filled) {
    g.clear();
    g.fillStyle(COLORS.panelNavyDeep, 1);
    g.fillCircle(0, 0, 12);
    g.lineStyle(2, COLORS.steel, 1);
    g.strokeCircle(0, 0, 12);
    if (filled) {
      const hex = [];
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        hex.push({ x: Math.cos(a) * 9.5, y: Math.sin(a) * 9.5 });
      }
      g.fillStyle(COLORS.craneYellowShade, 1);
      g.fillPoints(hex, true);
      g.fillStyle(COLORS.accent, 1);
      g.fillCircle(0, 0, 6.5);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(-2.5, -2.5, 2.2);
    } else {
      g.fillStyle(COLORS.steelDark, 1);
      g.fillCircle(0, 0, 5);
    }
  }

  renderCount(n) {
    this.count.setText(`${n} / ${this.total}`);
  }

  enter() {
    this.root.x = this.home.x + 60;
    this.root.alpha = 0;
    return tween(this.scene, { targets: this.root, x: this.home.x, alpha: 1, duration: 520, delay: 120, ease: 'Cubic.easeOut' });
  }

  async advanceTo(n, audio) {
    const s = this.scene;
    const idx = n - 1;
    const sock = this.sockets[idx];
    if (!sock) return;
    this.drawSocket(sock, true);
    sock.setScale(0).setAngle(-120);
    audio?.play('sfx.progress');
    await tween(s, { targets: sock, scale: 1, angle: 0, duration: 380, ease: 'Back.easeOut' });
    this.renderCount(n);
    this.completed = n;
    await tween(s, { targets: this.count, scale: 1.22, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
    await wait(s, 60);
  }

  /** Small engineering-points readout under the panel. Subtle, never a score race. */
  popPoints(points) {
    if (!points) return;
    const t = this.scene.add
      .text(this.home.x + W / 2, this.home.y + H + 18, `+${points} ENGINEERING PTS`, {
        fontFamily: FONTS.display,
        fontSize: '22px',
        fontStyle: '700',
        color: toCss(COLORS.correctTeal),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.ui)
      .setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 1, y: t.y - 6, duration: 260, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 1700, duration: 400, onComplete: () => t.destroy() });
  }

  exit() {
    return tween(this.scene, { targets: this.root, alpha: 0, x: this.home.x + 60, duration: 380, ease: 'Cubic.easeIn' });
  }
}
