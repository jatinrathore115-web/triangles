// Narrated feedback for a wrong pick, then escalating hints. Hint copy lives in the mission data;
// the diagnosis line is generated from the picked frame's geometry (src/data/narration.js).
//   every wrong pick -> "Not quite." + what THAT frame is (its deciding marking pulses as it is said)
//   then wrong #1    -> textual clue (+ brief, even pulse of all markings)
//        wrong #2    -> the relevant markings stay illuminated on every frame
//        wrong #3+   -> stronger visual guidance (equal-side bands / largest-angle wedges)
// Lines are spoken one after another, never over each other; a new attempt cancels what is queued.
// Guidance is applied to ALL frames equally, so the player still makes the decision.

import { wrongLine, wrongHighlight } from '../data/narration.js';
import { wait } from '../utils/async.js';

const BEAT_MS = 350; // natural pause between the diagnosis and the hint

export class HintSystem {
  constructor({ missionPanel, scoring }) {
    this.missionPanel = missionPanel;
    this.scoring = scoring;
    this.level = 0;
    this.run = 0;
  }

  setInventory(inventory) {
    this.inventory = inventory;
  }

  reset() {
    this.level = 0;
    this.run++;
  }

  async onWrong(mission, { frameId, frame } = {}) {
    const run = ++this.run;
    const live = () => run === this.run;
    this.level = Math.min(this.level + 1, 3);
    this.scoring?.noteHint(mission.id, this.level);

    // 1. what the picked frame actually is, with its deciding marking pulsing in step
    if (frameId) {
      const said = await this.missionPanel.showFeedback(wrongLine(mission, frameId));
      if (!live()) return;
      frame?.active && frame.pulseHighlight(wrongHighlight(mission, frameId), { repeat: 3, scale: 1.5, duration: 300 });
      await said.done;
      if (!live()) return;
      await wait(this.missionPanel.scene, BEAT_MS);
      if (!live()) return;
    }

    // 2. the hint, with its visual aid arriving as it is spoken
    const text = mission.hints[this.level - 1];
    this.missionPanel.pulseEmphasis();
    const jobs = [this.missionPanel.showHint(text, this.level)];
    if (this.level === 1) jobs.push(this.inventory.emphasizeMarkings());
    if (this.level === 2) jobs.push(this.inventory.illuminateMarkings());
    if (this.level >= 3) {
      const mode = mission.target.by === 'sides' ? 'equalSides' : 'largestAngle';
      // pulse first: the pulse repaints markings, the guides must be drawn after it
      jobs.push(this.inventory.emphasizeMarkings().then(() => this.inventory.showGuides(mode)));
    }
    await Promise.all(jobs);
  }

  clear() {
    this.run++;
    this.missionPanel.hideHint();
  }
}
