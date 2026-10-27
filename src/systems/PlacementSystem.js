// Interaction state machine:
//   idle -> selected -> (confirm) busy: hook, lift, carry, lower -> evaluate
//        -> correct: done            -> incorrect: back to idle (progress preserved)
// Selection never reveals correctness; only placement does.

import { BRIDGE } from '../data/bridgeLayout.js';
import { wait } from '../utils/async.js';

const CARRY_APEX_Y = 372; // carried frames travel in front of the bridge at this height

export class PlacementSystem {
  constructor(scene, deps) {
    Object.assign(this, deps); // crane, bridge, controls, missions, scoring, feedback, audio
    this.scene = scene;
    this.state = 'locked';
  }

  /** Bind a new mission + its yard. Placement stays locked until start(). */
  setMission(mission, inventory) {
    this.mission = mission;
    this.inventory = inventory;
    this.state = 'locked';
  }

  start() {
    this.state = 'idle';
    this.inventory.setEnabled(true);
    this.controls.setMode('place', false);
  }

  lock() {
    this.state = 'locked';
    this.inventory?.setEnabled(false);
  }

  get busy() {
    return this.state !== 'idle' && this.state !== 'selected';
  }

  select(i) {
    if (this.busy) return;
    if (this.inventory.selected === i && this.state === 'selected') return;
    this.audio.play('sfx.select');
    this.inventory.select(i);
    this.bridge.setSlotActive(true);
    this.controls.setMode('place', true);
    this.state = 'selected';

    // the crane answers the selection by gliding over the chosen frame (no attachment yet)
    const apex = this.inventory.apexWorld(i);
    this.crane.moveTrolleyTo(apex.x, { audio: this.audio });
    this.crane.ropeToTipY(apex.y - 74, { duration: 420 });
  }

  cycle(dir) {
    if (this.busy) return;
    const n = this.inventory.slots.length;
    const cur = this.inventory.selected < 0 ? (dir > 0 ? -1 : n) : this.inventory.selected;
    this.select((cur + dir + n) % n);
  }

  async confirm() {
    if (this.state !== 'selected') return;
    this.state = 'busy';
    const i = this.inventory.selected;
    const slot = this.inventory.slots[i];
    this.inventory.setEnabled(false);
    this.controls.setMode('busy', false);

    const { crane, inventory, bridge, audio } = this;

    // hook the frame at its lift point
    const apex = inventory.apexWorld(i);
    await crane.moveTrolleyTo(apex.x, { audio });
    await crane.steady(140);
    await crane.ropeToTipY(crane.tipYForApex(apex.y), { duration: 300 });
    audio.play('sfx.pickup');
    const frame = inventory.release(i);
    crane.attach(frame);
    await wait(this.scene, 90);

    // lift: grow to bridge scale and turn into installed orientation as it rises
    const targetScale = BRIDGE.pxPerMetre / inventory.pxPerMetre;
    this.scene.tweens.add({ targets: frame, scale: targetScale, carryRot: 0, duration: 620, ease: 'Sine.easeInOut' });
    await crane.ropeToTipY(crane.tipYForApex(CARRY_APEX_Y), { duration: 420, ease: 'Cubic.easeOut' });

    // carry to the slot
    const { apex: slotApex } = bridge.slotWorld();
    const approachApexY = Math.max(crane.minApexY, slotApex.y - 40);
    await crane.moveTrolleyTo(slotApex.x, { audio });
    await crane.steady(200);
    await crane.ropeToTipY(crane.tipYForApex(approachApexY), { duration: 300 });

    // evaluate from geometry
    const result = this.missions.evaluate(slot.id, this.mission);
    const record = this.scoring.attempt(this.mission.id, slot.id, result.correct);
    this.scene.events.emit('placement:evaluated', { frameId: slot.id, ...result });

    if (result.correct) {
      this.missions.complete(this.mission);
      this.state = 'done';
      await this.feedback.correct({ mission: this.mission, frameId: slot.id, frame, slotApex, completedCount: this.missions.completedCount, points: record.points });
      this.inventory.dismiss();
      this.scene.events.emit('mission:complete', { mission: this.mission, frame });
    } else {
      inventory.clearSelection();
      bridge.setSlotActive(false);
      await this.feedback.incorrect({ mission: this.mission, frameId: slot.id, frame, slotApex, slotIndex: i, approachApexY });
      this.state = 'idle';
      inventory.setEnabled(true);
      this.controls.setMode('place', false);
      this.scene.events.emit('placement:retry');
    }
  }
}
