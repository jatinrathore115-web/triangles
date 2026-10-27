// Stylised hammerhead tower crane standing on the right bank.
// Static lattice is drawn once; the trolley, rope, hook block and any carried frame
// are animated. The hook hangs on a damped pendulum driven by trolley acceleration,
// so every move produces natural, short-lived sway instead of scripted wobble.

import Phaser from 'phaser';
import { COLORS, DEPTH, TIMING } from '../config/theme.js';
import { shade } from '../systems/ProceduralArt.js';

export const CRANE_LAYOUT = {
  mastX: 1730,
  groundY: 626,
  jibTopY: 204,
  jibBottomY: 238,
  jibTipX: 360,
  counterJibEndX: 1905,
  apexY: 160,
  trolleyMinX: 400,
  trolleyMaxX: 1640,
  restTrolleyX: 1290,
  restRope: 200,
};

const HOOK_BLOCK_H = 34;
const HOOK_H = 20;
const SHACKLE = 8;
const MIN_ROPE = 42;

export class Crane {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    const L = CRANE_LAYOUT;
    this.layout = L;
    this.trolleyX = L.restTrolleyX;
    this.prevTrolleyX = this.trolleyX;
    this.prevVel = 0;
    this.rope = L.restRope; // trolley -> hook tip
    this.theta = 0;
    this.omega = 0;
    this.carried = null;
    this.idleTime = 0;
    this.damping = 2.4;

    this.structure = scene.add.graphics().setDepth(DEPTH.crane);
    this.drawStructure();

    this.trolley = scene.add.graphics().setDepth(DEPTH.crane + 1);
    this.drawTrolley();

    this.cable = scene.add.graphics().setDepth(DEPTH.carried - 1);
    this.hook = scene.add.container(0, 0).setDepth(DEPTH.carried + 1);
    this.drawHook();

    // amber work beacon on the apex: blinks while the site is active
    this.beacon = scene.add.image(L.mastX, L.apexY - 6, 'fx.glow').setDepth(DEPTH.crane + 2).setScale(0.12).setTint(0xffa33a).setBlendMode(Phaser.BlendModes.ADD);
    this.beaconCore = scene.add.circle(L.mastX, L.apexY - 6, 4, 0xffb347).setDepth(DEPTH.crane + 2);
    this.beaconTween = scene.tweens.add({ targets: [this.beacon, this.beaconCore], alpha: { from: 1, to: 0.25 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.update, this));
  }

  // ---------- drawing ----------

  drawStructure() {
    const g = this.structure;
    const L = this.layout;
    const Y = COLORS.craneYellow;
    const YS = COLORS.craneYellowShade;
    const YD = COLORS.craneYellowDark;
    const edge = COLORS.steelEdge;
    const mL = L.mastX - 22;
    const mR = L.mastX + 22;

    // footing
    g.fillStyle(COLORS.concreteDark, 1);
    g.fillRect(L.mastX - 70, L.groundY - 8, 140, 22);
    g.fillStyle(COLORS.concrete, 1);
    g.fillRect(L.mastX - 62, L.groundY - 18, 124, 12);
    g.fillStyle(shade(COLORS.concrete, 0.15), 1);
    g.fillRect(L.mastX - 62, L.groundY - 18, 124, 3);

    const strut = (x1, y1, x2, y2, w, c) => {
      g.lineStyle(w + 2.5, edge, 1);
      g.lineBetween(x1, y1, x2, y2);
      g.lineStyle(w, c, 1);
      g.lineBetween(x1, y1, x2, y2);
    };

    // mast lattice (diagonals first so chords sit on top)
    const mastTop = L.jibBottomY + 50;
    for (let y = L.groundY - 18; y > mastTop; y -= 44) {
      strut(mL, y, mR, y - 44, 3, YS);
      strut(mL, y - 44, mR, y - 44, 2.5, YS);
    }
    strut(mL, L.groundY - 18, mL, mastTop - 6, 6, Y);
    strut(mR, L.groundY - 18, mR, mastTop - 6, 6, YS);

    // slewing unit + cab
    g.fillStyle(edge, 1);
    g.fillRect(mL - 10, mastTop - 14, 64, 20);
    g.fillStyle(YD, 1);
    g.fillRect(mL - 8, mastTop - 12, 60, 16);
    const cabX = mL - 52;
    const cabY = L.jibBottomY + 4;
    g.fillStyle(edge, 1);
    g.fillRoundedRect(cabX - 2, cabY - 2, 56, 52, 6);
    g.fillStyle(Y, 1);
    g.fillRoundedRect(cabX, cabY, 52, 48, 5);
    g.fillStyle(0x9ed2e8, 1);
    g.fillRoundedRect(cabX + 6, cabY + 6, 30, 24, 3);
    g.fillStyle(0xffffff, 0.45);
    g.fillTriangle(cabX + 8, cabY + 8, cabX + 22, cabY + 8, cabX + 8, cabY + 22);
    g.fillStyle(YS, 1);
    g.fillRect(cabX + 40, cabY + 4, 8, 40);

    // apex tower
    strut(mL + 4, L.jibTopY, L.mastX, L.apexY, 5, Y);
    strut(mR - 4, L.jibTopY, L.mastX, L.apexY, 5, YS);
    strut(mL + 10, L.jibTopY - 26, mR - 10, L.jibTopY - 26, 2.5, YS);

    // tie cables
    g.lineStyle(2, 0x2a2f36, 0.9);
    g.lineBetween(L.mastX, L.apexY + 2, L.jibTipX + 260, L.jibTopY);
    g.lineBetween(L.mastX, L.apexY + 2, L.jibTipX + 760, L.jibTopY);
    g.lineBetween(L.mastX, L.apexY + 2, L.counterJibEndX - 30, L.jibTopY + 6);

    // jib: triangular lattice (Warren truss: a nod to the lesson)
    const step = 46;
    for (let x = L.mastX - 20; x > L.jibTipX + 10; x -= step) {
      const x2 = Math.max(L.jibTipX + 6, x - step / 2);
      const x3 = Math.max(L.jibTipX + 6, x - step);
      strut(x, L.jibBottomY, x2, L.jibTopY, 2.6, YS);
      strut(x2, L.jibTopY, x3, L.jibBottomY, 2.6, YS);
    }
    strut(L.jibTipX, L.jibTopY, L.mastX + 20, L.jibTopY, 5, Y);
    strut(L.jibTipX, L.jibBottomY, L.mastX + 20, L.jibBottomY, 7, YS);
    g.fillStyle(shade(Y, 0.3), 1);
    g.fillRect(L.jibTipX, L.jibTopY - 2.5, L.mastX - L.jibTipX, 1.5);
    // jib tip cap
    g.fillStyle(edge, 1);
    g.fillRect(L.jibTipX - 8, L.jibTopY - 6, 12, L.jibBottomY - L.jibTopY + 12);
    g.fillStyle(YD, 1);
    g.fillRect(L.jibTipX - 6, L.jibTopY - 4, 8, L.jibBottomY - L.jibTopY + 8);

    // counter-jib + counterweights
    strut(L.mastX + 20, L.jibTopY + 10, L.counterJibEndX, L.jibTopY + 10, 5, Y);
    strut(L.mastX + 20, L.jibBottomY, L.counterJibEndX, L.jibBottomY, 6, YS);
    for (let x = L.mastX + 20; x < L.counterJibEndX - 20; x += 34) strut(x, L.jibBottomY, x + 17, L.jibTopY + 10, 2.4, YS);
    for (let k = 0; k < 3; k++) {
      const x = L.counterJibEndX - 64 + k * 20;
      g.fillStyle(edge, 1);
      g.fillRect(x - 1, L.jibBottomY - 2, 20, 50);
      g.fillStyle(k % 2 ? COLORS.concreteShade : COLORS.concrete, 1);
      g.fillRect(x + 1, L.jibBottomY, 16, 46);
    }
    // hazard stripe on the counterweight
    g.fillStyle(COLORS.hazard, 1);
    g.fillRect(L.counterJibEndX - 64, L.jibBottomY + 38, 60, 6);
  }

  drawTrolley() {
    const g = this.trolley;
    g.clear();
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillRoundedRect(-24, -6, 48, 20, 3);
    g.fillStyle(COLORS.steel, 1);
    g.fillRoundedRect(-22, -4, 44, 16, 3);
    g.fillStyle(COLORS.steelLight, 1);
    g.fillRect(-20, -4, 40, 3);
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillCircle(-14, -6, 5);
    g.fillCircle(14, -6, 5);
    g.fillStyle(COLORS.bolt, 1);
    g.fillCircle(-14, -6, 2.4);
    g.fillCircle(14, -6, 2.4);
  }

  drawHook() {
    const g = this.scene.add.graphics();
    // block with hazard stripes
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillRoundedRect(-17, 0, 34, HOOK_BLOCK_H, 5);
    g.fillStyle(COLORS.craneYellow, 1);
    g.fillRoundedRect(-15, 2, 30, HOOK_BLOCK_H - 4, 4);
    g.fillStyle(COLORS.hazardDark, 1);
    for (let k = 0; k < 3; k++) {
      g.fillTriangle(-15 + k * 12, HOOK_BLOCK_H - 2, -15 + k * 12 + 6, HOOK_BLOCK_H - 2, -15 + k * 12 + 14, 10);
    }
    g.fillStyle(COLORS.bolt, 1);
    g.fillCircle(0, 9, 4);
    // hook
    g.lineStyle(7, COLORS.steelEdge, 1);
    g.beginPath();
    g.arc(2, HOOK_BLOCK_H + 10, 9, -Math.PI / 2, Math.PI * 0.85, false);
    g.strokePath();
    g.lineStyle(4.5, COLORS.steelLight, 1);
    g.beginPath();
    g.arc(2, HOOK_BLOCK_H + 10, 9, -Math.PI / 2, Math.PI * 0.85, false);
    g.strokePath();
    this.hook.add(g);
  }

  // ---------- simulation ----------

  get trolleyY() {
    return this.layout.jibBottomY + 4;
  }

  /** World position of the hook tip (the point the frame's shackle hangs from). */
  get hookTip() {
    return {
      x: this.trolleyX + Math.sin(this.theta) * this.rope,
      y: this.trolleyY + Math.cos(this.theta) * this.rope,
    };
  }

  update(time, deltaMs) {
    const dt = Math.min(deltaMs, 40) / 1000;
    if (dt <= 0) return;
    const vel = (this.trolleyX - this.prevTrolleyX) / dt;
    const acc = (vel - this.prevVel) / dt;
    this.prevTrolleyX = this.trolleyX;
    this.prevVel = vel;

    // damped pendulum driven by trolley acceleration
    const L = Math.max(80, this.rope);
    const g = 2600;
    this.idleTime += dt;
    const breeze = Math.sin(this.idleTime * 0.9) * 0.0009 * g; // tiny idle sway
    const alpha = -(g / L) * Math.sin(this.theta) - (Phaser.Math.Clamp(acc, -6000, 6000) / L) * Math.cos(this.theta) - this.damping * this.omega + breeze / L;
    this.omega += alpha * dt;
    this.theta = Phaser.Math.Clamp(this.theta + this.omega * dt, -0.32, 0.32);

    this.trolley.setPosition(this.trolleyX, this.layout.jibBottomY + 2);

    const tip = this.hookTip;
    const blockTop = { x: tip.x - Math.sin(this.theta) * (HOOK_BLOCK_H + HOOK_H), y: tip.y - Math.cos(this.theta) * (HOOK_BLOCK_H + HOOK_H) };
    this.hook.setPosition(blockTop.x, blockTop.y);
    this.hook.setRotation(-this.theta);

    this.cable.clear();
    this.cable.lineStyle(2, 0x23272d, 1);
    this.cable.lineBetween(this.trolleyX - 5, this.trolleyY + 8, blockTop.x - 5, blockTop.y + 2);
    this.cable.lineBetween(this.trolleyX + 5, this.trolleyY + 8, blockTop.x + 5, blockTop.y + 2);

    if (this.carried) {
      const f = this.carried;
      const apex = f.apexLocal;
      const s = f.scaleX;
      const rot = (f.carryRot ?? 0) - this.theta * 0.85;
      // place frame so its apex hangs SHACKLE px under the hook tip
      const ax = apex.x * s;
      const ay = apex.y * s;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const rx = ax * cos - ay * sin;
      const ry = ax * sin + ay * cos;
      f.setRotation(rot);
      f.setPosition(tip.x - rx, tip.y + SHACKLE - ry);
      this.cable.lineStyle(3, 0x3a3f46, 1);
      this.cable.lineBetween(tip.x, tip.y - 6, tip.x, tip.y + SHACKLE + 2);
    }
  }

  // ---------- motion primitives (all return promises) ----------

  /**
   * Run a single-property tween on a named channel. Starting a new move on the same
   * channel interrupts the old one, and interrupted moves still resolve their promise,
   * so no sequence can hang waiting on a cancelled animation.
   */
  channel(name, props) {
    this.channels ??= {};
    this.channels[name]?.stop();
    return new Promise((resolve) => {
      this.channels[name] = this.scene.tweens.add({
        targets: this,
        ...props,
        onComplete: resolve,
        onStop: resolve,
      });
    });
  }

  moveTrolleyTo(x, { duration, ease = 'Sine.easeInOut', audio } = {}) {
    const L = this.layout;
    const target = Phaser.Math.Clamp(x, L.trolleyMinX, L.trolleyMaxX);
    const dist = Math.abs(target - this.trolleyX);
    const d = duration ?? Phaser.Math.Clamp(dist / TIMING.trolleyPxPerMs, TIMING.minTravel, TIMING.maxTravel);
    if (dist < 1) {
      this.channels?.trolley?.stop();
      return Promise.resolve();
    }
    audio?.motor(d);
    return this.channel('trolley', { trolleyX: target, duration: d, ease });
  }

  /** Lower/raise so the hook tip reaches world y. */
  ropeToTipY(y, { duration = TIMING.hookDrop, ease = 'Sine.easeInOut' } = {}) {
    const rope = Math.max(MIN_ROPE, y - this.trolleyY);
    if (Math.abs(rope - this.rope) > 50) this.audio?.play('sfx.cable', { duration });
    return this.channel('rope', { rope, duration, ease });
  }

  /** Highest world y a carried frame's lift point can reach. */
  get minApexY() {
    return this.trolleyY + MIN_ROPE + SHACKLE;
  }

  /** Final sequence: trolley runs home to the mast, hook winds up, beacon stops. */
  async retract() {
    await Promise.all([this.moveTrolleyTo(this.layout.trolleyMaxX, { duration: 900, audio: this.audio }), this.ropeToTipY(this.trolleyY + MIN_ROPE, { duration: 900 })]);
  }

  setSiteComplete() {
    this.beaconTween?.stop();
    this.scene.tweens.add({ targets: [this.beacon, this.beaconCore], alpha: 0, duration: 500 });
  }

  /** Rope length so that a carried frame's apex sits at world y. */
  tipYForApex(apexY) {
    return apexY - SHACKLE;
  }

  /** Damp out residual sway quickly (used right before precise placement). */
  steady(duration = 220) {
    this.damping = 16;
    return new Promise((resolve) => {
      this.scene.time.delayedCall(duration, () => {
        this.damping = 2.4;
        resolve();
      });
    });
  }

  kick(impulse) {
    this.omega += impulse;
  }

  attach(frame) {
    this.carried = frame;
    frame.setDepth(DEPTH.carried);
  }

  detach() {
    const f = this.carried;
    this.carried = null;
    return f;
  }
}
