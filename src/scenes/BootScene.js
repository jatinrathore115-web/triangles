// Loads production assets listed in the manifest, waits for web fonts, generates
// procedural placeholders for everything else, and validates mission maths.

import Phaser from 'phaser';
import { TEXTURES, SOUNDS } from '../data/assetManifest.js';
import { generateTexture } from '../systems/ProceduralArt.js';
import { validateGameData } from '../data/validateData.js';
import { COLORS, FONTS, GAME_WIDTH, GAME_HEIGHT, toCss } from '../config/theme.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Preparing the construction site…', {
        fontFamily: 'sans-serif',
        fontSize: '28px',
        color: toCss(COLORS.textMuted),
      })
      .setOrigin(0.5);
    for (const [key, e] of Object.entries(TEXTURES)) if (e.path) this.load.image(key, e.path);
    for (const [key, e] of Object.entries(SOUNDS)) if (e.path) this.load.audio(key, e.path);
  }

  async create() {
    await Promise.race([
      Promise.all(
        ['600', '700', '800'].flatMap((w) => [document.fonts.load(`${w} 32px ${FONTS.display}`), document.fonts.load(`${w} 32px ${FONTS.body}`)]),
      ),
      new Promise((r) => setTimeout(r, 2500)),
    ]);

    for (const [key, entry] of Object.entries(TEXTURES)) {
      if (!this.textures.exists(key)) generateTexture(this, key, entry);
    }

    const check = validateGameData();
    if (!check.ok) console.error('[bridge] data validation failed', check.errors);
    else console.info('[bridge] mission data validated', check.report);

    this.scene.start('Build');
  }
}
