// Final construction sequence + bridge load test: the payoff for building the bridge.
//
//  FINAL ASSEMBLY: bolts connect along the span -> beams activate -> crane retracts ->
//  workers finish details -> deck surface -> safety rails -> lamps -> completion lighting,
//  with a slow camera push and rising music. Then "BRIDGE COMPLETE".
//  LOAD TEST: zone clears -> barrier opens -> vehicle crosses -> bridge holds ->
//  celebration on both banks.

import { COLORS, DEPTH, FONTS, GAME_WIDTH, toCss } from '../config/theme.js';
import { BRIDGE, toScreen } from '../data/bridgeLayout.js';
import { Vehicle } from '../components/Vehicle.js';
import { makePerson, wave, hop, workerVisit } from '../components/People.js';
import { drawHazardPlate } from '../ui/Banner.js';
import { tween, wait } from '../utils/async.js';
import { COPY } from '../data/narration.js';
import { WordText } from '../ui/WordText.js';
import { Narrator } from './Narrator.js';

export class FinaleSystem {
  constructor(scene, deps) {
    Object.assign(this, deps); // bridge, crane, env, banner, audio, fx, hud: {missionPanel, progress, controls}
    this.scene = scene;
  }

  async finalConstruction() {
    const s = this.scene;
    const { bridge, crane, banner, audio, fx, env } = this;
    const cam = s.cameras.main;

    await Promise.all([this.hud.missionPanel.exit(), this.hud.progress.exit(), tween(s, { targets: this.hud.controls.root, alpha: 0, y: this.hud.controls.root.y + 40, duration: 380, ease: 'Cubic.easeIn' })]);
    bridge.hideAllLabels();
    audio.play('sfx.complete');
    audio.play('music.rise');
    banner.show({ title: COPY.finalAssembly[0], subtitle: COPY.finalAssembly[1], y: 140, keep: true });

    // subtle cinematic push toward the span
    cam.pan(910, 520, 2600, 'Sine.easeInOut');
    cam.zoomTo(1.07, 2600, 'Sine.easeInOut');

    // sequential bolts connect
    await bridge.boltWave({
      onBolt: (f, b, i) => {
        if (i % 2 === 0) {
          const p = f.getWorldTransformMatrix().transformPoint(b.x, b.y);
          fx.sparks(p.x, p.y, 5);
        }
        if (i % 4 === 0) audio.play('sfx.bolt');
      },
    });
    // beams activate across the structure; the crane retracts
    crane.retract();
    await bridge.beamWave();

    // workers finish the details while the deck is surfaced
    await bridge.clearProps();
    const crewAt = [6, 18, 30, 42].map((m) => bridge.local({ x: m, y: 0 })).map((p) => ({ x: p.x, y: p.y - 10 }));
    await Promise.all([bridge.layDeck(1500), workerVisit(s, crewAt, { fx, audio, parent: bridge.details, duration: 1100 })]);
    await bridge.installRails();
    await bridge.installLamps();

    // construction lighting -> completion state
    crane.setSiteComplete();
    audio.stopConstructionAmbience();
    env.setCompletionLight();
    bridge.switchOnLamps();
    await wait(s, 500);

    await banner.hide();
    cam.pan(960, 540, 1100, 'Sine.easeInOut');
    cam.zoomTo(1, 1100, 'Sine.easeInOut');
    await wait(s, 1100);
    this.hud.progress.enter();
    await banner.show({ title: COPY.bridgeComplete[0], subtitle: COPY.bridgeComplete[1], y: 140, hold: 1200 });
  }

  async bridgeTest() {
    const s = this.scene;
    const { bridge, audio, env } = this;
    const roadY = bridge.roadY;
    const deckL = toScreen({ x: 0, y: 0 }).x;
    const deckR = toScreen({ x: BRIDGE.span, y: 0 }).x;

    // construction zone clears; townspeople gather on both banks
    env.clearSite();
    const crowd = this.spawnCrowd();
    const gauge = this.makeGauge();
    const barrier = this.makeBarrier(deckL - 64, roadY);
    await wait(s, 600);

    // barrier opens
    audio.play('sfx.barrier');
    await tween(s, { targets: barrier.arm, rotation: 1.45, duration: 800, ease: 'Back.easeOut' });

    // the vehicle drives across the finished bridge
    const vehicle = new Vehicle(s, { x: -190, y: roadY });
    const duration = 6200;
    audio.play('sfx.vehicle', { duration });
    let celebrated = false;
    await vehicle.drive(GAME_WIDTH + 200, {
      duration,
      bumpsAt: [deckL, deckR],
      onProgress: (x) => {
        const t = (x - deckL) / (deckR - deckL);
        bridge.setLoad(t);
        gauge.update(t);
        if (!celebrated && x > deckR + 40) {
          celebrated = true;
          this.celebrate(crowd, gauge);
        }
      },
    });
    bridge.setLoad(0);
    vehicle.destroy();
    await wait(s, 1400);
  }

  celebrate(crowd, gauge) {
    const s = this.scene;
    const { audio, bridge } = this;
    audio.play('sfx.horn');
    audio.play('music.success');
    gauge.pass();
    bridge.hangBunting();
    crowd.forEach((p, i) => {
      wave(s, p, { delay: i * 40, repeat: 5 });
      if (i % 2) hop(s, p, { delay: i * 60 });
    });
    const confetti = s.add
      .particles(0, 0, 'fx.confetti', {
        speed: { min: 380, max: 720 },
        angle: { min: 250, max: 290 },
        gravityY: 520,
        rotate: { start: 0, end: 540 },
        lifespan: 2600,
        scale: { min: 0.8, max: 1.4 },
        tint: [0x3ec3a3, 0xf2b134, 0x5b8fd6, 0xe8743b, 0xf3ead8],
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    confetti.explode(45, 160, 640);
    s.time.delayedCall(220, () => confetti.explode(45, 1780, 650));
    s.time.delayedCall(4000, () => confetti.destroy());
  }

  spawnCrowd() {
    const s = this.scene;
    const spots = [
      [40, 612],
      [78, 612],
      [116, 612],
      [154, 612],
      [1520, 622],
      [1556, 622],
      [1592, 622],
      [1810, 622],
      [1846, 622],
      [1882, 622],
    ];
    return spots.map(([x, y], i) => {
      const p = makePerson(s, { x, y, seed: i + 3, depth: DEPTH.bankFar + 4 });
      p.alpha = 0;
      tween(s, { targets: p, alpha: 1, duration: 400, delay: i * 70 });
      return p;
    });
  }

  makeBarrier(x, roadY) {
    const s = this.scene;
    const post = s.add.graphics({ x, y: roadY }).setDepth(DEPTH.vehicle + 1);
    post.fillStyle(COLORS.steelEdge, 1);
    post.fillRect(-6, -40, 12, 40);
    post.fillStyle(COLORS.hazard, 1);
    post.fillRect(-6, -40, 12, 6);
    const arm = s.add.graphics({ x, y: roadY - 30 }).setDepth(DEPTH.vehicle + 1);
    arm.fillStyle(COLORS.steelEdge, 1);
    arm.fillRect(-150, -5, 150, 10);
    for (let k = 0; k < 6; k++) {
      arm.fillStyle(k % 2 ? 0xf4f0e8 : 0xd9583b, 1);
      arm.fillRect(-148 + k * 24, -3, 24, 6);
    }
    return { post, arm };
  }

  /** LOAD TEST gauge: the needle stays in the safe band; the bridge holds. */
  makeGauge() {
    const s = this.scene;
    const c = s.add.container(960, 86).setDepth(DEPTH.ui);
    const w = 460;
    const h = 108;
    const g = s.add.graphics();
    drawHazardPlate(g, w, h);
    const title = s.add.text(-w / 2 + 40, -38, 'LOAD TEST', { fontFamily: FONTS.display, fontSize: '24px', fontStyle: '700', color: toCss(COLORS.textMuted) });
    title.setLetterSpacing?.(3);
    const status = s.add.text(w / 2 - 40, -38, 'STABLE', { fontFamily: FONTS.display, fontSize: '24px', fontStyle: '700', color: toCss(COLORS.correctTeal) }).setOrigin(1, 0);
    const bar = s.add.graphics();
    const bw = w - 80;
    bar.fillStyle(COLORS.panelNavyDeep, 1);
    bar.fillRoundedRect(-bw / 2, 4, bw, 18, 6);
    bar.fillStyle(COLORS.correctTeal, 0.85);
    bar.fillRoundedRect(-bw / 2, 4, bw * 0.62, 18, { tl: 6, bl: 6, tr: 0, br: 0 });
    bar.fillStyle(COLORS.accent, 0.85);
    bar.fillRect(-bw / 2 + bw * 0.62, 4, bw * 0.22, 18);
    bar.fillStyle(COLORS.incorrectRed, 0.85);
    bar.fillRoundedRect(-bw / 2 + bw * 0.84, 4, bw * 0.16, 18, { tl: 0, bl: 0, tr: 6, br: 6 });
    const needle = s.add.graphics();
    needle.fillStyle(0xffffff, 1);
    needle.fillTriangle(-7, -2, 7, -2, 0, 10);
    needle.fillRect(-1.5, 8, 3, 18);
    needle.x = -bw / 2 + 8;
    const captionStyle = { fontFamily: FONTS.body, fontSize: '17px', fontStyle: '600', color: toCss(COLORS.textMuted) };
    let caption = new WordText(s, 0, 28, [{ text: COPY.loadTestCrossing, style: captionStyle }], { align: 'center', maxWidth: w - 60, highlight: '#ffffff' });
    c.add([g, title, status, bar, needle, caption]);
    c.alpha = 0;
    tween(s, { targets: c, alpha: 1, duration: 400 }).then(() => Narrator.say(caption));
    return {
      update: (t) => {
        const load = t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0;
        needle.x = -bw / 2 + 8 + load * bw * 0.36 + Math.sin(t * 40) * 1.5;
      },
      pass: () => {
        status.setText('PASSED');
        // cross-fade to the result line, spoken word by word
        const old = caption;
        s.tweens.add({ targets: old, alpha: 0, duration: 200, onComplete: () => old.destroy() });
        caption = new WordText(s, 0, 28, [{ text: COPY.loadTestPassed, style: { ...captionStyle, color: toCss(COLORS.correctTeal) } }], { align: 'center', maxWidth: w - 60, highlight: '#ffffff' });
        c.add(caption);
        s.time.delayedCall(220, () => Narrator.say(caption));
        s.tweens.add({ targets: status, scale: 1.2, duration: 160, yoyo: true });
      },
      root: c,
    };
  }
}

