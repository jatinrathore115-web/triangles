// Correct / incorrect consequence sequences. Feedback is physical (snap, bolts, sparks,
// sway, workers) plus a short narrated explanation. No ticks, no big red X, no confetti walls.

import { COLORS } from '../config/theme.js';
import { BRIDGE, panelsForStage } from '../data/bridgeLayout.js';
import { correctCard } from '../data/narration.js';
import { workerVisit } from '../components/People.js';
import { wait } from '../utils/async.js';

export class FeedbackSystem {
  constructor(scene, deps) {
    Object.assign(this, deps); // crane, bridge, progress, card, fx, audio, hints, scorePopup
    this.scene = scene;
  }

  setInventory(inventory) {
    this.inventory = inventory;
  }

  get boltFx() {
    return {
      onBolt: (frame, bolt) => {
        const p = frame.getWorldTransformMatrix().transformPoint(bolt.x, bolt.y);
        this.fx.sparks(p.x, p.y, 9);
        this.audio.play('sfx.bolt');
      },
      onPanelLanded: (frame) => {
        const m = frame.getWorldTransformMatrix();
        frame.local.forEach((v) => {
          const p = m.transformPoint(v.x, v.y);
          if (p.y > BRIDGE.deckY - 8) this.fx.dust(p.x, p.y, 4);
        });
        this.audio.play('sfx.clank');
      },
    };
  }

  /** Tiny camera emphasis: a breath of zoom + a whisper of shake. Never more. */
  emphasis() {
    const cam = this.scene.cameras.main;
    cam.shake(140, 0.0016);
    this.scene.tweens.add({ targets: cam, zoom: 1.012, duration: 140, yoyo: true, ease: 'Sine.easeOut' });
  }

  /** Frame is hanging at its approach point above/near the slot (already steadied). */
  async correct({ mission, frameId, frame, slotApex, completedCount, points }) {
    const { crane, bridge, audio, fx } = this;

    // 1-2. align smoothly, then seat
    await crane.ropeToTipY(crane.tipYForApex(slotApex.y - 6), { duration: 220, ease: 'Sine.easeOut' });
    crane.detach();
    bridge.adoptFrame(frame, mission.slotPanel, BRIDGE.pxPerMetre / this.inventory.pxPerMetre);
    const restY = frame.y;
    frame.y = restY - 6;
    this.scene.tweens.add({ targets: frame, y: restY, duration: 160, ease: 'Back.easeOut' });
    bridge.hideSlot();
    this.hints.clear();
    frame.flashRim(COLORS.correctTeal, 420);

    // 3. metallic connection + tiny camera emphasis
    audio.play('sfx.clank');
    this.emphasis();
    // 6. subtle dust at the seated corners
    const m = frame.getWorldTransformMatrix();
    frame.local.forEach((v) => {
      const p = m.transformPoint(v.x, v.y);
      fx.dust(p.x, p.y + 4, 5);
    });

    audio.play('sfx.release');
    crane.ropeToTipY(crane.trolleyY + 160, { duration: 420 });

    // 4-5. bolts lock with tiny sparks
    await wait(this.scene, 140);
    audio.play('sfx.sparks');
    await bridge.lockBolts(frame, this.boltFx);

    // 7. neighbouring panels + beams assemble; a small crew welds the joints
    audio.play('sfx.assemble');
    crane.moveTrolleyTo(crane.layout.restTrolleyX, { audio });
    const stagePanels = panelsForStage(mission.bridgeStage);
    const crewPoints = stagePanels.slice(0, 2).map((p) => bridge.local({ x: (p.points[0].x + p.points[1].x + p.points[2].x) / 3, y: 0 }));
    await Promise.all([
      bridge.assembleStage(mission.bridgeStage, { except: [mission.slotPanel], fx: this.boltFx }),
      workerVisit(this.scene, crewPoints.map((p) => ({ x: p.x, y: p.y - 6 })), { fx, audio, parent: bridge.details, duration: 800 }),
    ]);

    // 8. short warm construction glow over the completed area
    await bridge.glowPanels(stagePanels.map((p) => p.id));

    // 9-10. bridge progress + engineering points
    await this.progress.advanceTo(completedCount, audio);
    this.progress.popPoints?.(points);

    // narrated reinforcement (praise, progress, rule, why this frame) + pulse the defining markings
    const card = this.cardAnchor(frame);
    const cardPromise = this.card.show(correctCard(mission, frameId), card);
    await wait(this.scene, 180);
    await Promise.all([cardPromise, frame.pulseHighlight(mission.reinforcement.highlight, { repeat: 3, scale: 1.6, duration: 280 })]);
  }

  /**
   * The yard is cleared after a correct install, so the card sits there (never over the
   * bridge) directly beneath the new frame, with a leader line up to it.
   */
  cardAnchor(frame) {
    const m = frame.getWorldTransformMatrix();
    const pts = frame.local.map((v) => m.transformPoint(v.x, v.y));
    const cx = (pts[0].x + pts[1].x + pts[2].x) / 3;
    const cy = (pts[0].y + pts[1].y + pts[2].y) / 3;
    const x = Math.min(Math.max(cx - 160, 360), 1500 - 420);
    return { x, y: 862, anchor: { x: cx, y: cy }, leaderFromTop: true };
  }

  /** Frame is hanging at the slot approach. The connection refuses it. */
  async incorrect({ mission, frameId, frame, slotApex, slotIndex, approachApexY }) {
    const { crane, bridge, inventory, audio, hints } = this;

    // 1. crane attempts positioning
    await crane.ropeToTipY(crane.tipYForApex(Math.max(approachApexY, slotApex.y - 10)), { duration: 200, ease: 'Sine.easeOut' });
    // 2. connection point rejects
    audio.play('sfx.reject');
    bridge.rejectFlash();
    frame.flashRim(COLORS.warn, 260);
    crane.kick(0.55);
    await crane.ropeToTipY(crane.tipYForApex(Math.max(crane.minApexY, slotApex.y - 46)), { duration: 160, ease: 'Back.easeOut' });

    // 3-4. bridge sways briefly + warning creak; 8. the frame's own markings flash
    audio.play('sfx.wobble');
    await Promise.all([bridge.wobble(), frame.pulseAllMarkings({ duration: 200 })]);

    // 7. narrated feedback starts while the crane returns the frame, so retry is immediate:
    //    what this frame actually is, then the escalating hint
    const hintPromise = hints.onWrong(mission, { frameId, frame });

    // 5. frame returns to its original place in the yard, turning back to its resting pose
    const sl = inventory.slots[slotIndex];
    this.scene.tweens.add({ targets: frame, scale: 1, carryRot: sl.restRot, duration: 600, ease: 'Sine.easeInOut' });
    await crane.ropeToTipY(crane.trolleyY + 130, { duration: 280 });
    const home = inventory.apexWorld(slotIndex);
    await crane.moveTrolleyTo(home.x, { audio });
    await crane.steady(160);
    await crane.ropeToTipY(crane.tipYForApex(home.y - 4), { duration: 300 });
    crane.detach();
    audio.play('sfx.release');
    await inventory.receive(slotIndex);
    crane.ropeToTipY(home.y - 90, { duration: 300 });
    hintPromise.catch(() => {});
  }
}
