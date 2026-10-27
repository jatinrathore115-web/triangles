// The frame yard: three triangular frames standing on timber pallets.
// Handles hover lift, selection lift, subduing the others, hint states, and giving frames
// to / taking frames back from the crane. Knows nothing about which frame is correct.
//
// Frames are built in their INSTALLED orientation and rotated into a stable resting pose
// (standing on the edge opposite their lift point). The crane turns them upright in flight.

import Phaser from 'phaser';
import { DEPTH, FONTS, TIMING, toCss } from '../config/theme.js';
import { framePoints } from '../data/triangleFrames.js';
import { TriangleFrame } from './TriangleFrame.js';
import { tween, stopTweensOf } from '../utils/async.js';
import { WordText } from '../ui/WordText.js';
import { Narrator } from '../systems/Narrator.js';
import { COPY } from '../data/narration.js';

const SLOT_XS = [625, 965, 1305];
const BASE_Y = 1004; // top of pallets
const MAX_FRAME_H = 200;
const MAX_FRAME_W = 214;
const LETTERS = ['A', 'B', 'C'];

const rot = (p, r) => ({ x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) });

export class InventoryTray {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ frames: {id:string, def:object}[], markings:string, onSelect:Function, audio:object }} cfg
   */
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.enabled = false;
    this.selected = -1;
    this.hovered = -1;
    this.objects = [];

    // probe frames at 1 px/m to find each resting bounding box, then share one scale so
    // relative sizes stay honest across the three options
    const probes = cfg.frames.map((f) => {
      const p = new TriangleFrame(scene, { points: framePoints(f.def), pxPerMetre: 1, markings: 'none' });
      const pts = p.rotatedLocal(p.restRotation);
      p.destroy();
      const xs = pts.map((v) => v.x);
      const ys = pts.map((v) => v.y);
      return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    });
    this.pxPerMetre = Math.min(MAX_FRAME_H / Math.max(...probes.map((p) => p.h)), MAX_FRAME_W / Math.max(...probes.map((p) => p.w)));
    this.slots = cfg.frames.map((f, i) => this.makeSlot(f, i));
  }

  makeSlot(f, i) {
    const s = this.scene;
    const x = SLOT_XS[i];
    const pallet = s.add.image(x, BASE_Y - 2, 'prop.pallet').setOrigin(0.5, 0).setDepth(DEPTH.inventory - 2);
    const shadow = s.add.ellipse(x, BASE_Y + 2, 180, 18, 0x2a1d10, 0.28).setDepth(DEPTH.inventory - 3);

    const frame = new TriangleFrame(s, {
      points: framePoints(f.def),
      pxPerMetre: this.pxPerMetre,
      material: f.def.material,
      markings: this.cfg.markings,
      showLabels: true,
      seed: 11 + i * 17 + f.id.length,
      id: f.id,
    });
    const restRot = frame.restRotation;
    const pts = frame.rotatedLocal(restRot);
    const xs = pts.map((v) => v.x);
    const ys = pts.map((v) => v.y);
    // container position so the resting edge sits on the pallet, centred on the slot
    const home = { x: x - (Math.min(...xs) + Math.max(...xs)) / 2, y: BASE_Y - Math.max(...ys) };
    frame.setPosition(home.x, home.y).setRotation(restRot).setDepth(DEPTH.inventory);
    s.add.existing(frame);

    const tag = s.add
      .text(x + 92, BASE_Y + 9, LETTERS[i], { fontFamily: FONTS.display, fontSize: '18px', fontStyle: '700', color: toCss(0x3b2612) })
      .setOrigin(0.5)
      .setDepth(DEPTH.inventory - 1)
      .setAlpha(0.8);

    const h = Math.max(...ys) - Math.min(...ys);
    const hitW = Math.max(Math.max(...xs) - Math.min(...xs) + 70, 210);
    const hitH = h + 80;
    const zone = s.add.zone(x, BASE_Y - hitH / 2 + 24, hitW, hitH).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => this.onHover(i, true));
    zone.on('pointerout', () => this.onHover(i, false));
    zone.on('pointerup', () => this.enabled && this.cfg.onSelect?.(i));

    this.objects.push(pallet, shadow, tag, zone);
    return { index: i, id: f.id, def: f.def, frame, pallet, shadow, tag, zone, home, restRot, inYard: true };
  }

  get selectedSlot() {
    return this.slots[this.selected];
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.slots.forEach((sl) => sl.zone.input && (sl.zone.input.cursor = enabled ? 'pointer' : 'default'));
    if (!enabled) this.hovered = -1;
  }

  liftFor(sl) {
    if (!sl.inYard) return null;
    if (sl.index === this.selected) return -16;
    if (sl.index === this.hovered && this.enabled) return -6;
    return 0;
  }

  applyLayout(duration = TIMING.hoverLift) {
    const anySel = this.selected >= 0;
    for (const sl of this.slots) {
      if (!sl.inYard) continue;
      const lift = this.liftFor(sl);
      const isSel = sl.index === this.selected;
      const subdued = anySel && !isSel;
      stopTweensOf(this.scene, [sl.frame, sl.shadow]);
      this.scene.tweens.add({
        targets: sl.frame,
        y: sl.home.y + lift,
        alpha: subdued ? 0.58 : 1,
        duration: isSel ? TIMING.selectLift : duration,
        ease: isSel ? 'Back.easeOut' : 'Sine.easeOut',
      });
      this.scene.tweens.add({ targets: sl.shadow, scaleX: 1 + -lift * 0.012, alpha: 0.28 - -lift * 0.006, duration });
      const hover = sl.index === this.hovered && this.enabled;
      sl.frame.setRim(isSel ? 1 : hover ? 0.38 : 0);
      sl.tag.setAlpha(subdued ? 0.45 : 0.8);
    }
  }

  onHover(i, over) {
    if (!this.enabled) {
      if (!over && this.hovered === i) this.hovered = -1;
      return;
    }
    if (over) {
      if (this.hovered !== i) this.cfg.audio?.play('sfx.hover');
      this.hovered = i;
    } else if (this.hovered === i) {
      this.hovered = -1;
    }
    this.applyLayout();
  }

  select(i) {
    this.selected = i;
    this.applyLayout();
  }

  clearSelection() {
    this.selected = -1;
    this.applyLayout();
  }

  /** World position of the lift point of a resting (lifted) frame: where the hook goes. */
  apexWorld(i) {
    const sl = this.slots[i];
    const a = rot(sl.frame.apexLocal, sl.restRot);
    return { x: sl.home.x + a.x, y: sl.home.y + (this.liftFor(sl) ?? 0) + a.y };
  }

  /** The crane takes the frame: the slot stops managing it. */
  release(i) {
    const sl = this.slots[i];
    sl.inYard = false;
    stopTweensOf(this.scene, sl.frame);
    sl.frame.setAlpha(1).setScale(1);
    sl.frame.carryRot = sl.restRot;
    this.scene.tweens.add({ targets: sl.shadow, alpha: 0.08, scaleX: 0.7, duration: 300 });
    return sl.frame;
  }

  /** The crane brings a rejected frame home. */
  async receive(i) {
    const sl = this.slots[i];
    const f = sl.frame;
    f.setDepth(DEPTH.inventory);
    await tween(this.scene, { targets: f, x: sl.home.x, y: sl.home.y, rotation: sl.restRot, scale: 1, duration: 160, ease: 'Sine.easeOut' });
    sl.inYard = true;
    this.scene.tweens.add({ targets: sl.shadow, alpha: 0.28, scaleX: 1, duration: 200 });
    this.applyLayout();
  }

  /** Hint level 1: brief, even emphasis of every frame's markings. */
  emphasizeMarkings() {
    return Promise.all(this.slots.filter((s) => s.inYard).map((s) => s.frame.pulseAllMarkings()));
  }

  /** Hint level 2: markings stay illuminated on every frame. */
  async illuminateMarkings() {
    await this.emphasizeMarkings();
    this.slots.forEach((s) => s.frame.setMarkingsLit(true));
  }

  /** Hint level 3: comparison guides on every frame (equal sides / largest angle). */
  showGuides(mode) {
    this.slots.forEach((s) => s.frame.setGuide(mode));
  }

  /** After success the yard clears so the reinforcement has the stage. */
  dismiss() {
    const items = [];
    this.slots.forEach((sl) => {
      sl.zone.disableInteractive();
      if (sl.inYard) items.push(sl.frame);
      items.push(sl.tag, sl.pallet, sl.shadow);
    });
    return tween(this.scene, { targets: items, alpha: 0, y: '+=24', duration: 360, ease: 'Cubic.easeIn' });
  }

  /** Remove everything this tray created except a frame that now belongs to the bridge. */
  destroy(keepFrame) {
    this.slots.forEach((sl) => {
      if (sl.frame !== keepFrame) {
        stopTweensOf(this.scene, sl.frame);
        sl.frame.destroy();
      }
    });
    this.objects.forEach((o) => {
      stopTweensOf(this.scene, o);
      o.destroy();
    });
  }

  enter() {
    const s = this.scene;
    return Promise.all(
      this.slots.map((sl, i) => {
        sl.frame.y = sl.home.y + 40;
        sl.frame.alpha = 0;
        sl.pallet.alpha = 0;
        s.tweens.add({ targets: sl.pallet, alpha: 1, duration: 300, delay: 200 + i * 90 });
        return tween(s, { targets: sl.frame, y: sl.home.y, alpha: 1, duration: 460, delay: 380 + i * 90, ease: 'Back.easeOut' });
      }),
    );
  }

  /** "Start here" guidance: frames bob once and a short tag says what to do. */
  nudge() {
    if (!this.enabled || this.selected >= 0 || this.nudging) return;
    this.nudging = true;
    const s = this.scene;
    this.slots.forEach((sl, i) => {
      if (!sl.inYard) return;
      s.tweens.add({ targets: sl.frame, y: sl.home.y - 12, duration: 180, delay: i * 110, yoyo: true, ease: 'Sine.easeOut' });
      sl.frame.setRim(0.6);
      s.time.delayedCall(900 + i * 110, () => this.selected < 0 && sl.index !== this.hovered && sl.frame.setRim(0));
    });
    const tag = s.add.container(SLOT_XS[1], BASE_Y - MAX_FRAME_H - 52).setDepth(DEPTH.inventory + 5);
    const t = new WordText(s, 0, -16, [{ text: COPY.nudge, style: { fontFamily: FONTS.display, fontSize: '26px', fontStyle: '700', color: '#1b2633' } }], { align: 'center', maxWidth: 600, highlight: '#7a3b0c' });
    const g = s.add.graphics();
    const w = t.textWidth + 36;
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-w / 2 + 2, -20 + 4, w, 40, 8);
    g.fillStyle(0xf2b134, 1).fillRoundedRect(-w / 2, -20, w, 40, 8);
    g.fillTriangle(-10, 20, 10, 20, 0, 32);
    tag.add([g, t]).setAlpha(0);
    this.objects.push(tag);
    s.tweens.add({ targets: tag, alpha: 1, y: tag.y + 6, duration: 240, ease: 'Back.easeOut' });
    // idle reminders are spoken when they appear (unless another line is being spoken)
    if (!Narrator.speaking) Narrator.say(t);
    else t.showAll();
    s.tweens.add({
      targets: tag,
      alpha: 0,
      delay: 2800,
      duration: 300,
      onComplete: () => {
        tag.destroy();
        this.nudging = false;
      },
    });
  }

  /** Centre of a frame's click zone (QA tooling). */
  zoneCentre(i) {
    const z = this.slots[i].zone;
    return { x: z.x, y: z.y };
  }

  get bounds() {
    return new Phaser.Geom.Rectangle(SLOT_XS[0] - 130, BASE_Y - MAX_FRAME_H - 50, SLOT_XS[2] - SLOT_XS[0] + 260, MAX_FRAME_H + 90);
  }
}
