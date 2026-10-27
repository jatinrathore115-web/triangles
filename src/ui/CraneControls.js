// Bottom-right crane control console with one primary action button.
// The button only confirms placement; it never reveals correctness.

import Phaser from 'phaser';
import { COLORS, DEPTH, FONTS, toCss } from '../config/theme.js';
import { drawSteelPanel } from './plate.js';
import { shade } from '../systems/ProceduralArt.js';
import { tween } from '../utils/async.js';

const W = 330;
const H = 176;
const BW = 270;
const BH = 70;

export class CraneControls {
  constructor(scene, { onPress, audio }) {
    this.scene = scene;
    this.onPress = onPress;
    this.audio = audio;
    this.enabled = false;
    this.home = { x: 1888 - W, y: 1080 - H - 24 };
    this.root = scene.add.container(this.home.x, this.home.y).setDepth(DEPTH.ui);
    const bg = scene.add.graphics();
    drawSteelPanel(bg, W, H);
    const title = scene.add.text(W / 2, 20, 'CRANE CONTROL', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      fontStyle: '700',
      color: toCss(COLORS.textMuted),
    });
    title.setOrigin(0.5, 0).setLetterSpacing?.(2);
    this.status = scene.add.text(W / 2, 136, '', {
      fontFamily: FONTS.body,
      fontSize: '19px',
      fontStyle: '600',
      color: toCss(COLORS.textMuted),
    });
    this.status.setOrigin(0.5, 0);

    this.btn = scene.add.container(W / 2, 88);
    this.btnG = scene.add.graphics();
    this.btnLabel = scene.add.text(0, 0, '', {
      fontFamily: FONTS.display,
      fontSize: '30px',
      fontStyle: '700',
      color: toCss(COLORS.textDark),
    });
    this.btnLabel.setOrigin(0.5);
    this.btn.add([this.btnG, this.btnLabel]);
    this.btn.setSize(BW, BH);
    this.btn.setInteractive({ useHandCursor: true });
    this.btn.on('pointerover', () => this.enabled && this.drawButton('hover'));
    this.btn.on('pointerout', () => this.drawButton(this.enabled ? 'idle' : 'disabled'));
    this.btn.on('pointerdown', () => {
      if (!this.enabled) return;
      this.drawButton('down');
      this.btn.y = 91;
    });
    this.btn.on('pointerup', () => {
      this.btn.y = 88;
      if (!this.enabled) {
        // a press on a disabled button is a sign of confusion: answer it visibly
        this.scene.tweens.add({ targets: this.btn, x: this.btn.x + 6, duration: 50, yoyo: true, repeat: 2 });
        this.scene.tweens.add({ targets: this.status, alpha: { from: 0.3, to: 1 }, duration: 160, repeat: 2 });
        this.onDisabledPress?.(this.mode);
        return;
      }
      this.drawButton('hover');
      this.onPress?.(this.mode);
    });

    this.root.add([bg, title, this.btn, this.status]);
    this.setMode('place', false);
  }

  drawButton(state) {
    const g = this.btnG;
    g.clear();
    const base = this.mode === 'next' ? 0x7fb069 : COLORS.accent;
    const c = state === 'disabled' ? COLORS.steelDark : state === 'hover' ? shade(base, 0.12) : state === 'down' ? shade(base, -0.1) : base;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-BW / 2 + 2, -BH / 2 + 5, BW, BH, 12);
    g.fillStyle(shade(c, -0.4), 1);
    g.fillRoundedRect(-BW / 2, -BH / 2 + 3, BW, BH, 12);
    g.fillStyle(c, 1);
    g.fillRoundedRect(-BW / 2, -BH / 2, BW, BH - 3, 12);
    g.fillStyle(0xffffff, state === 'disabled' ? 0.05 : 0.22);
    g.fillRoundedRect(-BW / 2 + 6, -BH / 2 + 4, BW - 12, BH * 0.36, 8);
    this.btnLabel.setColor(toCss(state === 'disabled' ? COLORS.textMuted : COLORS.textDark));
  }

  setMode(mode, enabled) {
    this.mode = mode;
    const labels = { place: 'PLACE ON BRIDGE', next: 'CONTINUE  ▸', busy: 'CRANE WORKING…' };
    const status = {
      place: enabled ? 'Enter / Space also works' : 'Select a frame first',
      next: 'Bridge section secured',
      busy: '',
    };
    this.btnLabel.setText(labels[mode]);
    this.status.setText(status[mode]);
    this.setEnabled(enabled);
  }

  setEnabled(enabled) {
    const was = this.enabled;
    this.enabled = enabled;
    this.drawButton(enabled ? 'idle' : 'disabled');
    this.btn.input && (this.btn.input.cursor = enabled ? 'pointer' : 'default');
    if (enabled && !was) {
      this.scene.tweens.add({ targets: this.btn, scale: 1.06, duration: 160, yoyo: true, ease: 'Sine.easeOut' });
    }
  }

  enter() {
    this.root.y = this.home.y + 60;
    this.root.alpha = 0;
    return tween(this.scene, { targets: this.root, y: this.home.y, alpha: 1, duration: 520, delay: 260, ease: 'Cubic.easeOut' });
  }

  get bounds() {
    return new Phaser.Geom.Rectangle(this.home.x, this.home.y, W, H);
  }
}
