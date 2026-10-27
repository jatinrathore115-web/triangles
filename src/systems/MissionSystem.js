// Mission flow + answer evaluation.
// Correctness is decided from the frame's GEOMETRY (classification), not from a stored
// answer id, so data mistakes cannot silently teach the wrong concept.

import { MISSIONS, TOTAL_MISSIONS } from '../data/missions.js';
import { TRIANGLE_FRAMES, TRIANGLE_TYPES, framePoints } from '../data/triangleFrames.js';
import { classify } from '../utils/geometry.js';

export class MissionSystem {
  constructor(state) {
    this.state = state;
  }

  get total() {
    return TOTAL_MISSIONS;
  }

  get completedCount() {
    return this.state.completedMissions.length;
  }

  get current() {
    return MISSIONS[this.state.missionIndex] ?? null;
  }

  get allComplete() {
    return this.completedCount >= TOTAL_MISSIONS;
  }

  optionsFor(mission = this.current) {
    return mission.options.map((id) => ({ id, def: TRIANGLE_FRAMES[id] }));
  }

  classifyFrame(frameId) {
    return classify(framePoints(TRIANGLE_FRAMES[frameId]));
  }

  evaluate(frameId, mission = this.current) {
    const c = this.classifyFrame(frameId);
    const actual = c[mission.target.by];
    return { correct: actual === mission.target.type, actual, classification: c, typeInfo: TRIANGLE_TYPES[actual] };
  }

  complete(mission = this.current) {
    if (!this.state.completedMissions.includes(mission.id)) this.state.completedMissions.push(mission.id);
    if (!this.state.completedStages.includes(mission.bridgeStage)) this.state.completedStages.push(mission.bridgeStage);
  }

  /** Advance to the next mission; returns null when the bridge is finished. */
  next() {
    if (this.state.missionIndex + 1 >= MISSIONS.length) return null;
    this.state.missionIndex += 1;
    return MISSIONS[this.state.missionIndex];
  }
}
