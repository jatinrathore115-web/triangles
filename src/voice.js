// Voice-over player: ONE reused <audio> element, unlocked on the first user gesture.
// Narration turns itself off (lines then type silently) when the browser cannot play Ogg Opus,
// when the URL has ?vo=0, or when a clip fails to load/play. It never throws into the game.
//   ?vospeed=2   debug playback-rate multiplier (clamped 0.5 - 4)

const params = new URLSearchParams(location.search);
const CLIP_DIR = 'assets/vo/';

class VoicePlayer {
  constructor() {
    this.el = typeof Audio !== 'undefined' ? new Audio() : null;
    const canOpus = !!this.el?.canPlayType('audio/ogg; codecs="opus"');
    this.enabled = canOpus && params.get('vo') !== '0';
    this.rate = Math.min(4, Math.max(0.5, parseFloat(params.get('vospeed')) || 1));
    this.unlocked = false;
    this.current = null; // clip id
    this.cache = new Map();
    this.listeners = { start: [], end: [] };
    if (this.el) {
      this.el.preload = 'auto';
      this.el.addEventListener('ended', () => this.emit('end'));
    }
  }

  on(ev, fn) {
    this.listeners[ev].push(fn);
  }

  off(ev, fn) {
    this.listeners[ev] = this.listeners[ev].filter((f) => f !== fn);
  }

  emit(ev) {
    this.listeners[ev].forEach((fn) => fn());
  }

  /** Call from a user gesture (Start tap): play muted then pause, so tablets allow later playback. */
  unlock() {
    if (!this.enabled || this.unlocked || !this.el) return;
    this.unlocked = true;
    try {
      this.el.muted = true;
      this.el.src = `${CLIP_DIR}vo001.ogg`;
      const p = this.el.play();
      const done = () => {
        // a real clip may already have started on this element: never pause or mute it
        if (this.current) return;
        this.el.pause();
        this.el.muted = false;
      };
      if (p?.then) p.then(done, done);
      else done();
    } catch {
      this.el.muted = false;
    }
  }

  /**
   * Start a clip. Resolves to true when audio is actually playing, false when the line must
   * fall back to silent, clock-driven typing.
   */
  async play(id) {
    this.stop();
    if (!this.enabled || !this.el || !id) return false;
    this.current = id;
    try {
      this.el.muted = false;
      this.el.src = `${CLIP_DIR}${id}.ogg`;
      this.el.playbackRate = this.rate;
      await this.el.play();
      if (this.current !== id) return false;
      this.emit('start');
      return true;
    } catch {
      if (this.current === id) this.current = null;
      return false;
    }
  }

  stop() {
    if (!this.el || !this.current) return;
    this.current = null;
    try {
      this.el.pause();
    } catch {}
    this.emit('end');
  }

  get time() {
    return this.el?.currentTime ?? 0;
  }

  get playing() {
    return !!this.current && !!this.el && !this.el.paused && !this.el.ended;
  }

  /** After Start: quietly fetch every clip, one at a time, so each is ready when needed. */
  async prefetch(ids) {
    if (!this.enabled) return;
    for (const id of ids) {
      if (this.cache.has(id)) continue;
      const a = new Audio();
      a.preload = 'auto';
      this.cache.set(id, a);
      await new Promise((res) => {
        const t = setTimeout(res, 4000);
        a.addEventListener('canplaythrough', () => (clearTimeout(t), res()), { once: true });
        a.addEventListener('error', () => (clearTimeout(t), res()), { once: true });
        a.src = `${CLIP_DIR}${id}.ogg`;
        a.load();
      });
    }
  }
}

export const voice = new VoicePlayer();
