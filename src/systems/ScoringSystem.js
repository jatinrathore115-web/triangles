// Engineering score. Learning is never blocked: a mission always awards its base points
// once solved; only the bonus shrinks with mistakes and hint use. No timers.

export const SCORE_RULES = {
  base: 100, // awarded for completing a stage
  bonusMax: 50, // first-attempt correct answer keeps the full bonus
  perWrong: 12,
  perHintLevel: 6,
  stars: [
    { min: 0.93, stars: 3 },
    { min: 0.75, stars: 2 },
    { min: 0, stars: 1 },
  ],
};

export class ScoringSystem {
  constructor() {
    this.records = new Map();
  }

  record(missionId) {
    if (!this.records.has(missionId)) {
      this.records.set(missionId, { attempts: 0, wrong: 0, wrongFrames: [], hintLevel: 0, solvedFirstTry: null, points: 0, startedAt: Date.now(), solvedAt: null });
    }
    return this.records.get(missionId);
  }

  noteHint(missionId, level) {
    const r = this.record(missionId);
    r.hintLevel = Math.max(r.hintLevel, level);
  }

  attempt(missionId, frameId, correct) {
    const r = this.record(missionId);
    r.attempts += 1;
    if (!correct) {
      r.wrong += 1;
      r.wrongFrames.push(frameId);
    } else if (r.solvedAt == null) {
      r.solvedAt = Date.now();
      r.solvedFirstTry = r.wrong === 0;
      const bonus = Math.max(0, SCORE_RULES.bonusMax - SCORE_RULES.perWrong * r.wrong - SCORE_RULES.perHintLevel * r.hintLevel);
      r.bonus = bonus;
      r.points = SCORE_RULES.base + bonus;
    }
    return r;
  }

  get total() {
    let t = 0;
    this.records.forEach((r) => (t += r.points));
    return t;
  }

  maxFor(missionCount) {
    return missionCount * (SCORE_RULES.base + SCORE_RULES.bonusMax);
  }

  stars(missionCount) {
    const ratio = this.total / this.maxFor(missionCount);
    return SCORE_RULES.stars.find((s) => ratio >= s.min).stars;
  }

  firstTryCount() {
    let n = 0;
    this.records.forEach((r) => r.solvedFirstTry && n++);
    return n;
  }

  summary() {
    return [...this.records.entries()].map(([id, r]) => ({ id, ...r }));
  }
}
