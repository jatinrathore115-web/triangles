// The ONE place narration happens: every voiced line goes through Narrator.say().
//  1. looks the line up by its exact displayed text (WordText.key) in src/vo_lines.js
//  2. plays its clip on the single voice element
//  3. reveals + highlights each word at the moment it is spoken, driven by the audio's own
//     currentTime (so playback rate, buffering and stalls can never desync text and voice)
//  4. resolves when the voice has finished; safety timeout = remaining duration + 600 ms
// Lines without a clip (or with narration off) are revealed silently at the same pacing.
// A new line stops the previous one; stopAll() is called on mission change / replay.

import { voice } from '../voice.js';
import { VO_LINES } from '../vo_lines.js';

const SILENT_WORD_S = 0.3; // pace for lines that have no clip at all

class NarratorImpl {
  constructor() {
    this.active = null;
    this.stats = { voiced: 0, silent: 0, missing: new Set(), shown: [] };
  }

  /**
   * @param {import('../ui/WordText.js').WordText} wt
   * @param {{speak?: boolean}} opts  speak:false reveals at once (a prompt brought back after a hint)
   * @returns {{done: Promise<void>, finishText: Function, stop: Function}}
   */
  say(wt, { speak = true } = {}) {
    this.stop();
    const entry = VO_LINES[wt.key];
    this.stats.shown.push(wt.key);
    if (!entry) this.stats.missing.add(wt.key);
    if (!speak) {
      wt.showAll({ instant: false });
      return { done: Promise.resolve(), finishText() {}, stop() {} };
    }
    const scene = wt.scene;
    const n = wt.words.length;
    const times = entry ? entry[2] : Array.from({ length: n }, (_, i) => 0.15 + i * SILENT_WORD_S);
    const duration = entry ? entry[1] : times[n - 1] + 0.6;
    const speechEnd = entry ? entry[3] : duration;
    let resolve;
    const done = new Promise((r) => (resolve = r));
    const job = {
      wt,
      clip: entry?.[0],
      started: performance.now(),
      audio: false,
      lastT: -1,
      lastAdvance: performance.now(),
      next: 0,
      finished: false,
      resolve,
      textFull: false,
    };
    this.active = job;

    const finish = () => {
      if (job.finished) return;
      job.finished = true;
      scene.events.off('update', tick);
      wt.active && wt.showAll();
      if (this.active === job) this.active = null;
      resolve();
    };
    job.finish = finish;

    // clock used when there is no audio (silent line, narration off, play() rejected)
    const clock = () => ((performance.now() - job.started) / 1000) * voice.rate;
    const tick = () => {
      if (!wt.active) {
        // the text was removed while speaking: stop its voice too
        if (this.active === job) voice.stop();
        return finish();
      }
      let t;
      if (job.audio) {
        t = voice.time;
        const now = performance.now();
        if (t !== job.lastT) {
          job.lastT = t;
          job.lastAdvance = now;
        } else if (now - job.lastAdvance > 1200 && !voice.playing) {
          // stalled or stopped externally: carry on with the clock from here
          job.audio = false;
          job.started = now - (t / voice.rate) * 1000;
        }
      } else t = clock();
      while (job.next < n && t >= times[job.next]) {
        if (!job.textFull) wt.revealWord(job.next);
        job.next++;
      }
      if (job.next >= n && t >= speechEnd + 0.15) wt.clearHighlight();
      if (!job.audio && t >= duration) finish();
    };
    scene.events.on('update', tick);
    // safety: never wait longer than the clip (+600 ms), whatever happens to the audio.
    // Re-armed with the remaining duration once the audio is really playing.
    job.safety = scene.time.delayedCall((duration / voice.rate + (entry ? 2.5 : 0.6)) * 1000, finish);

    if (entry) {
      this.stats.voiced++;
      voice.play(entry[0]).then((ok) => {
        if (job.finished || this.active !== job) return;
        if (ok) {
          job.audio = true;
          job.lastAdvance = performance.now();
          job.safety?.remove();
          job.safety = scene.time.delayedCall(((duration - voice.time) / voice.rate + 0.6) * 1000, finish);
          const onEnd = () => {
            voice.el?.removeEventListener('ended', onEnd);
            // the voice finished: reveal anything left and resolve shortly after
            scene.time.delayedCall(120, finish);
          };
          voice.el?.addEventListener('ended', onEnd);
        } else {
          job.started = performance.now();
        }
      });
    } else this.stats.silent++;

    return {
      done,
      /** tap while typing: show the whole line now, the voice carries on */
      finishText: () => {
        job.textFull = true;
        wt.showAll();
      },
      stop: () => {
        if (this.active === job) this.stop();
      },
    };
  }

  /** Stop whatever is being said (new line, skip, mission change, restart). */
  stop() {
    const job = this.active;
    this.active = null;
    voice.stop();
    if (job && !job.finished) {
      job.safety?.remove();
      job.finish();
    }
  }

  get speaking() {
    return !!this.active;
  }
}

export const Narrator = new NarratorImpl();
if (typeof window !== 'undefined') window.__vo = { Narrator, voice, VO_LINES };
