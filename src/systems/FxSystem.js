// Small particle effects: welding sparks when bolts lock, dust when frames seat.

import Phaser from 'phaser';
import { COLORS, DEPTH } from '../config/theme.js';

export class FxSystem {
  constructor(scene) {
    this.scene = scene;
    this.sparkEmitter = scene.add
      .particles(0, 0, 'fx.spark', {
        speed: { min: 140, max: 380 },
        angle: { min: 200, max: 340 },
        gravityY: 950,
        lifespan: { min: 260, max: 620 },
        scale: { start: 0.75, end: 0 },
        tint: [0xffffff, COLORS.spark, 0xffb347],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.dustEmitter = scene.add
      .particles(0, 0, 'fx.dust', {
        speed: { min: 18, max: 70 },
        angle: { min: 190, max: 350 },
        gravityY: -18,
        lifespan: { min: 700, max: 1150 },
        scale: { start: 0.45, end: 1.5 },
        alpha: { start: 0.55, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx - 1);
  }

  sparks(x, y, count = 12) {
    this.sparkEmitter.explode(count, x, y);
  }

  dust(x, y, count = 6) {
    this.dustEmitter.explode(count, x, y);
  }
}
