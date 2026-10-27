// Audio: plays production files from the manifest when present, otherwise synthesises
// short procedural SFX with WebAudio (metal clanks, bolt ratchets, crane motor...).
// Everything is low-volume and short so audio supports, never distracts.

import { SOUNDS } from '../data/assetManifest.js';

export class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.muted = false;
    this.ctx = scene.sound?.context ?? null; // Phaser's WebAudio context (null with NoAudio)
    if (this.ctx) {
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      // music + ambience bed: ducks under the voice-over
      this.bed = this.ctx.createGain();
      this.bed.gain.value = 0.55 / 0.55;
      this.bed.connect(this.master);
      this.noise = this.makeNoise();
    }
  }

  get ready() {
    if (!this.ctx || this.muted) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx.state === 'running';
  }

  setMuted(m) {
    this.muted = m;
  }

  play(key, opts = {}) {
    const entry = SOUNDS[key];
    if (!entry) return;
    if (entry.path && this.scene.cache.audio.exists(key)) {
      if (!this.muted) this.scene.sound.play(key, { volume: opts.volume ?? 0.8 });
      return;
    }
    if (!this.ready) return;
    const fn = this[`synth_${entry.synth}`];
    fn?.call(this, opts);
  }

  /** Music + ambience duck under the voice (0.55 -> 0.2 relative level, time constant 0.25 s). */
  duck(on) {
    if (!this.ctx || !this.bed) return;
    const t = this.ctx.currentTime;
    this.bed.gain.cancelScheduledValues(t);
    this.bed.gain.setTargetAtTime(on ? 0.2 / 0.55 : 1, t, 0.25);
  }

  motor(durationMs) {
    this.play('sfx.motor', { duration: durationMs });
  }

  // ---------- ambience (looping beds; production loops replace these via the manifest) ----------

  startAmbience() {
    if (!this.ready || this.ambience) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    // water: filtered noise with a slow swell
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03, t0 + 2);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.12;
    const lg = c.createGain();
    lg.gain.value = 0.012;
    lfo.connect(lg);
    lg.connect(g.gain);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.bed);
    src.start();
    lfo.start();
    // construction site: occasional distant clank / ratchet
    this.siteTimer = this.scene.time.addEvent({
      delay: 4200,
      loop: true,
      callback: () => {
        if (!this.ready || Math.random() < 0.35) return;
        const base = 180 + Math.random() * 120;
        [1, 2.7].forEach((r, i) => this.tone({ freq: base * r, decay: 0.4, peak: 0.018 / (i + 1) }));
        if (Math.random() < 0.5) for (let k = 0; k < 3; k++) this.burst({ at: 0.3 + k * 0.05, freq: 2600, q: 5, peak: 0.012, decay: 0.02 });
      },
    });
    this.ambience = { src, lfo, gain: g };
    this.scene.events.once('shutdown', () => this.stopAmbience(true));
  }

  stopConstructionAmbience() {
    this.siteTimer?.remove();
    this.siteTimer = null;
  }

  stopAmbience(instant = false) {
    this.stopConstructionAmbience();
    if (!this.ambience) return;
    const { src, lfo, gain } = this.ambience;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (instant ? 0.05 : 1));
    src.stop(t + (instant ? 0.1 : 1.1));
    lfo.stop(t + (instant ? 0.1 : 1.1));
    this.ambience = null;
  }

  // ---------- building blocks ----------

  makeNoise() {
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  env(gainNode, t0, { attack = 0.004, peak = 0.3, decay = 0.3, hold = 0 }) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    if (hold) g.setValueAtTime(peak, t0 + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + decay);
    return t0 + attack + hold + decay;
  }

  tone({ type = 'sine', freq, freqEnd, at = 0, attack, peak, decay, hold, filter, bus }) {
    const c = this.ctx;
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + (attack ?? 0.004) + (hold ?? 0) + (decay ?? 0.3));
    const g = c.createGain();
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter();
      Object.assign(f, { type: filter.type });
      f.frequency.value = filter.freq;
      f.Q.value = filter.q ?? 1;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(bus === 'bed' ? this.bed : this.master);
    const end = this.env(g, t0, { attack, peak, decay, hold });
    o.start(t0);
    o.stop(end + 0.05);
    return o;
  }

  burst({ at = 0, type = 'bandpass', freq = 2000, q = 1, peak = 0.2, decay = 0.08, attack = 0.002 }) {
    const c = this.ctx;
    const t0 = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    const end = this.env(g, t0, { attack, peak, decay });
    src.start(t0, Math.random() * 0.5);
    src.stop(end + 0.05);
  }

  // ---------- synth recipes ----------

  synth_hover() {
    this.tone({ freq: 1500, decay: 0.04, peak: 0.025 });
  }

  synth_select() {
    this.burst({ freq: 1400, q: 3, peak: 0.16, decay: 0.05 });
    this.tone({ type: 'triangle', freq: 420, freqEnd: 360, decay: 0.09, peak: 0.12 });
  }

  synth_motor({ duration = 500 }) {
    const c = this.ctx;
    const t0 = c.currentTime;
    const d = duration / 1000;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(58, t0);
    o.frequency.linearRampToValueAtTime(74, t0 + d * 0.5);
    o.frequency.linearRampToValueAtTime(60, t0 + d);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 340;
    const g = c.createGain();
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.08);
    g.gain.setValueAtTime(0.06, t0 + Math.max(0.09, d - 0.12));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.05);
    o.start(t0);
    o.stop(t0 + d + 0.1);
  }

  synth_hookAttach() {
    this.burst({ freq: 3500, q: 5, peak: 0.14, decay: 0.03 });
    this.tone({ freq: 1320, decay: 0.22, peak: 0.07 });
    this.tone({ freq: 2790, decay: 0.14, peak: 0.04 });
  }

  synth_clank() {
    // inharmonic partials = struck steel
    const base = 300 + Math.random() * 30;
    [1, 2.76, 5.4, 8.93].forEach((r, i) => this.tone({ freq: base * r, decay: 0.55 / (i + 1) + 0.08, peak: 0.16 / (i + 1) }));
    this.burst({ type: 'highpass', freq: 1800, peak: 0.22, decay: 0.07 });
    this.tone({ freq: 120, freqEnd: 70, decay: 0.2, peak: 0.25 });
  }

  synth_bolt() {
    for (let k = 0; k < 3; k++) this.burst({ at: k * 0.035, freq: 3200 + k * 200, q: 6, peak: 0.12, decay: 0.025 });
    this.tone({ at: 0.1, freq: 1900, decay: 0.08, peak: 0.04 });
  }

  synth_sparks() {
    for (let k = 0; k < 7; k++) this.burst({ at: Math.random() * 0.25, type: 'highpass', freq: 4500, peak: 0.06 + Math.random() * 0.05, decay: 0.02 });
  }

  synth_assemble() {
    for (let k = 0; k < 3; k++) {
      this.tone({ at: k * 0.12, freq: 180 - k * 12, freqEnd: 110, decay: 0.15, peak: 0.16 });
      this.burst({ at: k * 0.12, freq: 900, q: 1.5, peak: 0.08, decay: 0.05 });
    }
  }

  synth_reject() {
    this.tone({ freq: 150, freqEnd: 62, decay: 0.38, peak: 0.34 });
    this.burst({ freq: 500, q: 1, peak: 0.16, decay: 0.12 });
    // soft two-tone warning buzz (not a harsh alarm)
    this.tone({ type: 'square', freq: 196, at: 0.06, decay: 0.12, hold: 0.06, peak: 0.035, filter: { type: 'lowpass', freq: 900 } });
    this.tone({ type: 'square', freq: 165, at: 0.26, decay: 0.16, hold: 0.06, peak: 0.035, filter: { type: 'lowpass', freq: 900 } });
  }

  synth_creak() {
    const c = this.ctx;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 210;
    const lfo = c.createOscillator();
    lfo.frequency.value = 11;
    const lg = c.createGain();
    lg.gain.value = 45;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 820;
    f.Q.value = 7;
    const g = c.createGain();
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    const end = this.env(g, t0, { attack: 0.06, peak: 0.07, hold: 0.25, decay: 0.4 });
    o.start(t0);
    lfo.start(t0);
    o.stop(end + 0.05);
    lfo.stop(end + 0.05);
  }

  synth_progress() {
    this.tone({ type: 'triangle', freq: 660, decay: 0.35, peak: 0.1 });
    this.tone({ type: 'triangle', freq: 990, at: 0.11, decay: 0.45, peak: 0.08 });
  }

  synth_release() {
    this.tone({ freq: 190, freqEnd: 110, decay: 0.14, peak: 0.16 });
    this.burst({ freq: 1200, q: 2, peak: 0.07, decay: 0.04 });
  }

  synth_cable({ duration = 400 }) {
    // winch whine
    const d = duration / 1000;
    this.tone({ type: 'triangle', freq: 380, freqEnd: 520, attack: 0.05, hold: Math.max(0, d - 0.15), decay: 0.1, peak: 0.02, filter: { type: 'lowpass', freq: 1400 } });
  }

  synth_pickup() {
    this.synth_hookAttach();
    this.tone({ freq: 240, freqEnd: 180, at: 0.05, decay: 0.12, peak: 0.08 });
  }

  synth_weld({ duration = 800 }) {
    const n = Math.floor(duration / 60);
    for (let k = 0; k < n; k++) this.burst({ at: k * 0.06 + Math.random() * 0.03, type: 'highpass', freq: 3800, peak: 0.025 + Math.random() * 0.02, decay: 0.03 });
  }

  synth_wobble() {
    this.synth_creak();
    this.tone({ freq: 70, freqEnd: 55, decay: 0.6, peak: 0.12 });
  }

  synth_checkpoint() {
    [523, 659, 784].forEach((f, i) => this.tone({ type: 'triangle', freq: f, at: i * 0.09, decay: 0.5, peak: 0.07 }));
  }

  synth_complete() {
    // final lock: big clank + rising shimmer
    this.synth_clank();
    [392, 494, 587, 784].forEach((f, i) => this.tone({ type: 'triangle', freq: f, at: 0.15 + i * 0.12, decay: 0.9, peak: 0.06 }));
  }

  synth_barrier() {
    this.tone({ type: 'sawtooth', freq: 140, freqEnd: 190, attack: 0.05, hold: 0.5, decay: 0.15, peak: 0.03, filter: { type: 'lowpass', freq: 600 } });
    this.burst({ at: 0.7, freq: 900, q: 2, peak: 0.08, decay: 0.05 });
  }

  synth_vehicle({ duration = 5000 }) {
    const c = this.ctx;
    const t0 = c.currentTime;
    const d = duration / 1000;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(52, t0);
    o.frequency.linearRampToValueAtTime(88, t0 + d * 0.45);
    o.frequency.linearRampToValueAtTime(64, t0 + d);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = c.createGain();
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.6);
    g.gain.setValueAtTime(0.05, t0 + d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.start(t0);
    o.stop(t0 + d + 0.1);
  }

  synth_horn() {
    [0, 0.22].forEach((at) => {
      this.tone({ type: 'square', freq: 392, at, hold: 0.1, decay: 0.08, peak: 0.04, filter: { type: 'lowpass', freq: 1800 } });
      this.tone({ type: 'square', freq: 494, at, hold: 0.1, decay: 0.08, peak: 0.03, filter: { type: 'lowpass', freq: 1800 } });
    });
  }

  /** Music rises under the final construction sequence (~4 s). */
  synth_rise() {
    const chords = [
      [196, 247, 294],
      [220, 277, 330],
      [247, 311, 370],
      [262, 330, 392],
    ];
    chords.forEach((ch, i) =>
      ch.forEach((f) => this.tone({ type: 'triangle', freq: f, at: i * 0.9, attack: 0.3, hold: 0.5, decay: 0.6, peak: 0.035 + i * 0.008, filter: { type: 'lowpass', freq: 1200 + i * 400 }, bus: 'bed' })),
    );
  }

  /** Tasteful success fanfare for the bridge test. */
  synth_success() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((f, i) => this.tone({ type: 'triangle', freq: f, at: i * 0.13, decay: 0.45, peak: 0.08, bus: 'bed' }));
    [262, 330, 392].forEach((f) => this.tone({ type: 'sine', freq: f, at: 0.5, attack: 0.2, hold: 0.8, decay: 1.2, peak: 0.05, bus: 'bed' }));
  }
}
