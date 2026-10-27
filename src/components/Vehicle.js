// The test vehicle for the bridge payoff: a faceted, low-poly utility SUV in a teal livery.
// Facing right. Wheels spin with distance travelled; a soft headlight beam leads it.

import Phaser from 'phaser';
import { COLORS, DEPTH } from '../config/theme.js';
import { shade } from '../systems/ProceduralArt.js';
import { tween } from '../utils/async.js';

const BODY = 0x2f86a0;
const WHEEL_R = 14;

export class Vehicle {
  constructor(scene, { x = -200, y = 586 } = {}) {
    this.scene = scene;
    this.root = scene.add.container(x, y).setDepth(DEPTH.vehicle);
    const g = scene.add.graphics();
    const poly = (pts, c) => {
      g.fillStyle(c, 1);
      g.fillPoints(pts.map(([px, py]) => ({ x: px, y: py })), true);
    };
    // shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(0, 2, 170, 10);
    // lower body (two facets: lit top band, shaded skirt)
    poly([[-80, -12], [80, -12], [84, -24], [78, -36], [-76, -36], [-82, -24]], COLORS.steelEdge);
    poly([[-78, -24], [82, -24], [77, -34], [-74, -34]], shade(BODY, 0.12));
    poly([[-78, -13], [79, -13], [82, -24], [-80, -24]], shade(BODY, -0.12));
    // cabin
    poly([[-60, -35], [56, -35], [32, -64], [-48, -64]], COLORS.steelEdge);
    poly([[-57, -36], [53, -36], [30, -62], [-46, -62]], shade(BODY, 0.2));
    // windows
    poly([[-50, -40], [-8, -40], [-8, -58], [-42, -58]], 0x9fd3e6);
    poly([[-2, -40], [46, -40], [27, -58], [-2, -58]], 0x9fd3e6);
    poly([[-46, -56], [-30, -56], [-40, -42], [-48, -42]], 0xd8f0f7);
    poly([[4, -56], [20, -56], [8, -42], [0, -42]], 0xd8f0f7);
    // roof rack + amber beacon (site vehicle)
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillRect(-36, -68, 56, 4);
    g.fillStyle(COLORS.accent, 1);
    g.fillRoundedRect(-8, -75, 14, 7, 2);
    // livery stripe
    g.fillStyle(COLORS.accent, 1);
    g.fillRect(-76, -28, 156, 3);
    // lights
    g.fillStyle(0xfff3cf, 1);
    g.fillRoundedRect(74, -31, 8, 7, 2);
    g.fillStyle(0xd9583b, 1);
    g.fillRoundedRect(-82, -31, 6, 7, 2);
    // wheel arches
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillCircle(-48, -10, WHEEL_R + 4);
    g.fillCircle(50, -10, WHEEL_R + 4);

    this.beam = scene.add.image(150, -24, 'fx.glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1c8).setDisplaySize(170, 50).setAlpha(0.5);
    this.wheels = [-48, 50].map((wx) => {
      const w = scene.add.graphics({ x: wx, y: -10 });
      w.fillStyle(0x1d2227, 1);
      w.fillCircle(0, 0, WHEEL_R);
      w.fillStyle(0x8f9ba6, 1);
      w.fillCircle(0, 0, WHEEL_R * 0.5);
      w.fillStyle(0x3b434b, 1);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        w.fillCircle(Math.cos(a) * WHEEL_R * 0.3, Math.sin(a) * WHEEL_R * 0.3, 1.6);
      }
      w.fillStyle(0xffffff, 0.35);
      w.fillCircle(-3, -3, 2);
      return w;
    });
    this.body = scene.add.container(0, 0, [g]);
    this.root.add([this.beam, this.body, ...this.wheels]);
  }

  /**
   * Drive along y from the current x to `toX`. onProgress(x) fires every frame.
   */
  drive(toX, { duration = 5200, onProgress, bumpsAt = [] } = {}) {
    const fromX = this.root.x;
    let lastX = fromX;
    const hit = new Set();
    return tween(this.scene, {
      targets: this.root,
      x: toX,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const x = this.root.x;
        const d = x - lastX;
        lastX = x;
        this.wheels.forEach((w) => (w.rotation += d / WHEEL_R));
        // gentle suspension bob, plus a small bump over each expansion joint
        let bob = Math.sin(x / 23) * 0.5;
        for (const j of bumpsAt) {
          if (!hit.has(j) && x > j) {
            hit.add(j);
            this.scene.tweens.add({ targets: this.body, y: -2.5, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
          }
        }
        this.body.x = 0;
        this.wheels.forEach((w) => (w.y = -10 + bob * 0.2));
        onProgress?.(x);
      },
    });
  }

  destroy() {
    this.root.destroy();
  }
}
