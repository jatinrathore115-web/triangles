// Layered world: sky -> far mountains -> mid hills/towns -> river -> cliffs -> yard.
// Ambient motion is restrained: slow cloud drift, gentle water shimmer, pier foam.

import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH } from '../config/theme.js';
import { BRIDGE } from '../data/bridgeLayout.js';

export const WORLD = {
  waterTop: 728,
  yardTop: 846,
};

export class Environment {
  constructor(scene) {
    this.scene = scene;
    const s = scene;
    s.add.image(0, 0, 'env.sky').setOrigin(0).setDepth(DEPTH.sky);

    this.clouds = [
      s.add.image(380, 120, 'env.cloud.a').setAlpha(0.9),
      s.add.image(1120, 80, 'env.cloud.b').setAlpha(0.8),
      s.add.image(1480, 210, 'env.cloud.b').setAlpha(0.6).setScale(0.7),
      s.add.image(820, 230, 'env.cloud.a').setAlpha(0.55).setScale(0.6),
    ];
    this.clouds.forEach((c, i) => {
      c.setDepth(DEPTH.sky + 1);
      c.driftSpeed = 4 + i * 2.2; // px / second
    });

    s.add.image(0, 250, 'env.mountains.far').setOrigin(0).setDepth(DEPTH.farTerrain);
    s.add.image(0, 400, 'env.hills.mid').setOrigin(0).setDepth(DEPTH.midTerrain);
    s.add.image(0, WORLD.waterTop, 'env.water').setOrigin(0).setDepth(DEPTH.water);

    this.makeWaterMotion();

    s.add.image(0, 560, 'env.cliff.left').setOrigin(0).setDepth(DEPTH.bankFar);
    s.add.image(1360, 560, 'env.cliff.right').setOrigin(0).setDepth(DEPTH.bankFar);

    s.add.image(0, WORLD.yardTop, 'env.yard').setOrigin(0).setDepth(DEPTH.foreground);
    this.placeProps();

    s.events.on('update', this.update, this);
    s.events.once('shutdown', () => s.events.off('update', this.update, this));
  }

  makeWaterMotion() {
    const s = this.scene;
    const rng = new Phaser.Math.RandomDataGenerator(['river']);
    this.shimmers = [];
    for (let i = 0; i < 22; i++) {
      const y = WORLD.waterTop + 14 + rng.frac() * 110;
      const depthT = (y - WORLD.waterTop) / 120;
      const img = s.add
        .image(rng.between(0, GAME_WIDTH), y, 'fx.shimmer')
        .setDepth(DEPTH.water + 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.4 + depthT * 0.9, 0.5 + depthT * 0.6)
        .setAlpha(0);
      img.baseAlpha = 0.18 + depthT * 0.22;
      img.speed = 6 + depthT * 14;
      s.tweens.add({
        targets: img,
        alpha: { from: 0, to: img.baseAlpha },
        duration: 1600 + rng.between(0, 1400),
        yoyo: true,
        repeat: -1,
        delay: rng.between(0, 2400),
        ease: 'Sine.easeInOut',
      });
      this.shimmers.push(img);
    }
    // foam ring where the pier meets the water
    for (const p of BRIDGE.pillars) {
      const x = BRIDGE.originX + p.x * BRIDGE.pxPerMetre;
      const foam = s.add.ellipse(x, WORLD.waterTop + 62, 128, 16, 0xd9f1f5, 0.5).setDepth(DEPTH.bridgeBack + 1);
      s.tweens.add({ targets: foam, scaleX: 1.12, alpha: 0.28, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  placeProps() {
    const s = this.scene;
    const d = DEPTH.foreground + 1;
    // kept to the edges so the frame yard stays clean
    this.siteProps = [
      s.add.image(150, 1010, 'prop.beams').setOrigin(0.5, 1).setDepth(d),
      s.add.image(300, 1040, 'prop.crate').setOrigin(0.5, 1).setDepth(d),
      s.add.image(390, 1046, 'prop.cone').setOrigin(0.5, 1).setDepth(d).setScale(0.9),
      s.add.image(1440, 1046, 'prop.cone').setOrigin(0.5, 1).setDepth(d).setScale(0.8),
      s.add.image(1660, 640, 'prop.crate').setOrigin(0.5, 1).setDepth(DEPTH.bankFar + 1).setScale(0.6),
      s.add.image(1560, 640, 'prop.beams').setOrigin(0.5, 1).setDepth(DEPTH.bankFar + 1).setScale(0.5),
      s.add.image(190, 628, 'prop.cone').setOrigin(0.5, 1).setDepth(DEPTH.bankFar + 1).setScale(0.55),
    ];
  }

  /** Construction zone clears for the load test. */
  clearSite() {
    this.scene.tweens.add({ targets: this.siteProps, alpha: 0, y: '+=10', duration: 500, ease: 'Sine.easeIn' });
  }

  /** Lighting shifts from work-site to completion: a warm, late-afternoon glow. */
  setCompletionLight() {
    const s = this.scene;
    const warm = s.add.rectangle(0, 0, GAME_WIDTH, 1080, 0xffc98a, 0).setOrigin(0).setDepth(DEPTH.fx - 2).setBlendMode(Phaser.BlendModes.ADD);
    const sun = s.add.image(260, 120, 'fx.glow').setDepth(DEPTH.sky + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(5).setAlpha(0).setTint(0xffd7a0);
    s.tweens.add({ targets: warm, fillAlpha: 0.07, duration: 1400, ease: 'Sine.easeInOut' });
    s.tweens.add({ targets: sun, alpha: 0.5, duration: 1600, ease: 'Sine.easeInOut' });
  }

  update(time, delta) {
    const dt = delta / 1000;
    for (const c of this.clouds) {
      c.x += c.driftSpeed * dt;
      if (c.x - c.displayWidth / 2 > GAME_WIDTH) c.x = -c.displayWidth / 2;
    }
    for (const sh of this.shimmers) {
      sh.x += sh.speed * dt;
      if (sh.x - sh.displayWidth / 2 > GAME_WIDTH) sh.x = -sh.displayWidth / 2;
    }
  }
}
