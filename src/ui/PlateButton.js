// Reusable game button: painted-steel plate with hover / pressed / disabled states.

import { COLORS, FONTS, toCss } from '../config/theme.js';
import { shade } from '../systems/ProceduralArt.js';

export class PlateButton {
  constructor(scene, { x, y, width = 260, height = 60, label, onPress, color = COLORS.accent, audio }) {
    this.scene = scene;
    this.w = width;
    this.h = height;
    this.color = color;
    this.enabled = true;
    this.onPress = onPress;
    this.audio = audio;
    this.root = scene.add.container(x, y);
    this.g = scene.add.graphics();
    this.label = scene.add
      .text(0, -1, label, { fontFamily: FONTS.display, fontSize: `${Math.round(height * 0.42)}px`, fontStyle: '700', color: toCss(COLORS.textDark) })
      .setOrigin(0.5);
    this.root.add([this.g, this.label]);
    this.root.setSize(width, height).setInteractive({ useHandCursor: true });
    this.root.on('pointerover', () => {
      if (!this.enabled) return;
      this.draw('hover');
      this.audio?.play('sfx.hover');
    });
    this.root.on('pointerout', () => this.draw(this.enabled ? 'idle' : 'disabled'));
    this.root.on('pointerdown', () => this.enabled && this.draw('down'));
    this.root.on('pointerup', () => {
      if (!this.enabled) return;
      this.draw('hover');
      this.audio?.play('sfx.select');
      this.onPress?.();
    });
    this.draw('idle');
  }

  draw(state) {
    const { g, w, h } = this;
    g.clear();
    const c = state === 'disabled' ? COLORS.steelDark : state === 'hover' ? shade(this.color, 0.12) : state === 'down' ? shade(this.color, -0.12) : this.color;
    const dy = state === 'down' ? 3 : 0;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, 12);
    g.fillStyle(shade(c, -0.42), 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 12);
    g.fillStyle(c, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + dy, w, h - 3, 12);
    g.fillStyle(0xffffff, state === 'disabled' ? 0.05 : 0.22);
    g.fillRoundedRect(-w / 2 + 6, -h / 2 + 4 + dy, w - 12, h * 0.34, 8);
    if (state === 'hover') {
      g.lineStyle(2, 0xfff6dc, 0.9);
      g.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1 + dy, w - 2, h - 5, 11);
    }
    this.label.y = -1 + dy;
    this.label.setColor(toCss(state === 'disabled' ? COLORS.textMuted : COLORS.textDark));
  }

  setEnabled(e) {
    this.enabled = e;
    this.draw(e ? 'idle' : 'disabled');
  }

  setLabel(t) {
    this.label.setText(t);
  }
}
