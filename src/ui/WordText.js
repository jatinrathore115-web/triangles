// Text laid out as individual words so narration can reveal and highlight each one as it is
// spoken. A WordText has one or more parts (e.g. title + body); each part starts a new line.
// Its key (parts joined by "\n") is exactly the string the voice-over map is keyed on.

import Phaser from 'phaser';
import { COLORS, toCss } from '../config/theme.js';

export class WordText extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x
   * @param {number} y
   * @param {{text:string, style:object, emphasis?:string, emphasisStyle?:object, gapBefore?:number}[]} parts
   * @param {{maxWidth?:number, align?:'left'|'center', lineHeight?:number, highlight?:string, hidden?:boolean}} opts
   */
  constructor(scene, x, y, parts, opts = {}) {
    super(scene, x, y);
    scene.add.existing(this);
    this.opts = { maxWidth: 800, align: 'left', lineHeight: 1.18, highlight: toCss(COLORS.markingPulse), ...opts };
    this.key = parts.map((p) => p.text).join('\n');
    this.words = [];
    let y0 = 0;
    let maxW = 0;
    for (const part of parts) {
      y0 += part.gapBefore ?? 0;
      const lower = part.text.toLowerCase();
      const eStart = part.emphasis ? lower.indexOf(part.emphasis.toLowerCase()) : -1;
      const eEnd = eStart + (part.emphasis?.length ?? 0);
      const probe = scene.add.text(0, 0, ' ', part.style);
      const spaceW = probe.width;
      const lh = probe.height * this.opts.lineHeight;
      probe.destroy();
      const lines = [[]];
      let cx = 0;
      const re = /\S+/g;
      let m;
      while ((m = re.exec(part.text))) {
        const em = eStart >= 0 && m.index >= eStart && m.index < eEnd;
        const style = em ? { ...part.style, ...part.emphasisStyle } : part.style;
        const obj = scene.add.text(0, 0, m[0], style);
        if (part.letterSpacing) obj.setLetterSpacing?.(part.letterSpacing);
        if (cx > 0 && cx + obj.width > this.opts.maxWidth) {
          lines.push([]);
          cx = 0;
        }
        lines[lines.length - 1].push({ obj, x: cx, em });
        cx += obj.width + spaceW;
      }
      for (const line of lines) {
        const lw = line.length ? line[line.length - 1].x + line[line.length - 1].obj.width : 0;
        maxW = Math.max(maxW, lw);
        const off = this.opts.align === 'center' ? -lw / 2 : 0;
        for (const w of line) {
          w.obj.setPosition(w.x + off, y0);
          w.baseY = y0;
          w.color = w.obj.style.color;
          this.add(w.obj);
          this.words.push(w);
        }
        y0 += lh;
      }
    }
    this.textWidth = maxW;
    this.textHeight = y0;
    this.revealed = 0;
    if (opts.hidden !== false) this.hideAll();
  }

  get emphasisWords() {
    return this.words.filter((w) => w.em).map((w) => w.obj);
  }

  hideAll() {
    this.revealed = 0;
    for (const w of this.words) {
      this.scene.tweens.killTweensOf(w.obj);
      w.obj.setAlpha(0).setY(w.baseY + 6).setColor(w.color);
    }
  }

  /** Reveal word i (smooth rise + fade) and highlight it as the word being spoken. */
  revealWord(i, { highlight = true } = {}) {
    const w = this.words[i];
    if (!w) return;
    this.scene.tweens.add({ targets: w.obj, alpha: 1, y: w.baseY, duration: 170, ease: 'Cubic.easeOut' });
    if (highlight) w.obj.setColor(this.opts.highlight);
    // the previous word settles back to its own colour
    const prev = this.words[i - 1];
    if (prev && highlight) prev.obj.setColor(prev.color);
    this.revealed = Math.max(this.revealed, i + 1);
  }

  /** Show every remaining word (tap-to-skip, silent repeats, or narration finished). */
  showAll({ instant = false } = {}) {
    this.words.forEach((w, i) => {
      if (i >= this.revealed || instant) {
        this.scene.tweens.killTweensOf(w.obj);
        if (instant) w.obj.setAlpha(1).setY(w.baseY);
        else this.scene.tweens.add({ targets: w.obj, alpha: 1, y: w.baseY, duration: 200, delay: (i - this.revealed) * 18, ease: 'Cubic.easeOut' });
      }
      w.obj.setColor(w.color);
    });
    this.revealed = this.words.length;
  }

  clearHighlight() {
    this.words.forEach((w) => w.obj.setColor(w.color));
  }
}
