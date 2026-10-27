// Top-left site signboard: "BRIDGE REQUIREMENT" + stage chip + the mission instruction.
// A one-line hint row can slide open underneath; the panel never reaches the crane jib.

import { COLORS, DEPTH, FONTS, toCss } from '../config/theme.js';
import { STAGES } from '../data/missions.js';
import { WRONG_LEAD } from '../data/narration.js';
import { drawSteelPanel, drawTag } from './plate.js';
import { WordText } from './WordText.js';
import { Narrator } from '../systems/Narrator.js';
import { tween } from '../utils/async.js';

const W = 940;
const BASE_H = 124;
const HINT_H = 46;

export class MissionPanel {
  constructor(scene, { x = 28, y = 18 } = {}) {
    this.scene = scene;
    this.home = { x, y };
    this.root = scene.add.container(x, y).setDepth(DEPTH.ui);
    this.bg = scene.add.graphics();
    this.tagG = scene.add.graphics();
    this.tagText = scene.add.text(48, 20, 'BRIDGE REQUIREMENT', {
      fontFamily: FONTS.display,
      fontSize: '20px',
      fontStyle: '700',
      color: toCss(COLORS.textDark),
    });
    this.tagText.setLetterSpacing?.(2);
    drawTag(this.tagG, this.tagText.width + 20, 28);
    this.tagG.setPosition(38, 18);
    this.stageText = scene.add.text(this.tagText.x + this.tagText.width + 30, 21, '', {
      fontFamily: FONTS.display,
      fontSize: '19px',
      fontStyle: '700',
      color: toCss(COLORS.selectCyan),
    });
    this.stageText.setLetterSpacing?.(2);
    this.content = scene.add.container(0, 0);
    this.hintRow = scene.add.container(40, BASE_H - 12).setAlpha(0);
    this.root.add([this.bg, this.tagG, this.tagText, this.stageText, this.content, this.hintRow]);
    this.height = BASE_H;
    this.redraw(BASE_H);
  }

  redraw(h) {
    drawSteelPanel(this.bg, W, h, { hazardStrip: true });
  }

  setMission(mission) {
    this.stageText.setText(STAGES[mission.stage]?.label ?? '');
    this.content.removeAll(true);
    // words start hidden; narrateInstruction() reveals each one as it is spoken
    this.instruction = new WordText(
      this.scene,
      40,
      58,
      [
        {
          text: mission.instruction,
          emphasis: mission.emphasis,
          style: { fontFamily: FONTS.body, fontSize: '31px', fontStyle: '600', color: toCss(COLORS.textLight) },
          emphasisStyle: { color: toCss(COLORS.accentWarm), fontStyle: '800' },
        },
      ],
      { maxWidth: W - 74, highlight: '#ffffff' },
    );
    this.content.add(this.instruction);
    this.hideHint(true);
  }

  /** Speak the requirement, revealing it word by word. Returns the narration handle. */
  narrateInstruction() {
    return Narrator.say(this.instruction);
  }

  /** Animated swap to the next mission's requirement. */
  async swapMission(mission) {
    this.hideHint();
    await tween(this.scene, { targets: this.content, alpha: 0, x: -16, duration: 200, ease: 'Sine.easeIn' });
    this.setMission(mission);
    this.content.x = 24;
    this.scene.tweens.add({ targets: this.stageText, alpha: { from: 0.2, to: 1 }, duration: 300 });
    await tween(this.scene, { targets: this.content, alpha: 1, x: 0, duration: 320, ease: 'Cubic.easeOut' });
  }

  enter() {
    this.root.x = this.home.x - 60;
    this.root.alpha = 0;
    return tween(this.scene, { targets: this.root, x: this.home.x, alpha: 1, duration: 520, ease: 'Cubic.easeOut' });
  }

  exit() {
    return tween(this.scene, { targets: this.root, x: this.home.x - 60, alpha: 0, duration: 380, ease: 'Cubic.easeIn' });
  }

  /** Briefly brighten the emphasised words (used together with marking emphasis). */
  pulseEmphasis() {
    const words = this.instruction?.emphasisWords ?? [];
    this.scene.tweens.add({ targets: words, scale: 1.06, duration: 180, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  }

  /** Hint row: escalating clue. Spoken as it appears; returns the narration handle. */
  showHint(text, level = 1) {
    return this.showRow(text, (icon) => {
      // icon: matching marks = "compare the markings" language; dots show hint level
      icon.lineStyle(5.5, COLORS.markingOutline, 1);
      icon.lineBetween(12, 8, 12, 26);
      icon.lineBetween(22, 8, 22, 26);
      icon.lineStyle(3.4, COLORS.marking, 1);
      icon.lineBetween(12, 8, 12, 26);
      icon.lineBetween(22, 8, 22, 26);
      for (let k = 0; k < 3; k++) {
        icon.fillStyle(k < level ? COLORS.accentWarm : COLORS.steelDark, 1);
        icon.fillCircle(46 + k * 10, 17, 3);
      }
    }, { color: COLORS.accentWarm });
  }

  /**
   * Same row, used first after a wrong pick: "Not quite." + what that frame actually is.
   * Calm, light text (no red, no X); the lead words carry the accent.
   */
  showFeedback(text) {
    return this.showRow(text, (icon) => {
      // icon: a small frame outline = "this frame"
      icon.lineStyle(3, COLORS.textMuted, 1);
      icon.strokeTriangle(8, 26, 26, 26, 17, 8);
    }, { color: COLORS.textLight, emphasis: WRONG_LEAD, emphasisColor: COLORS.accentWarm });
  }

  async showRow(text, drawIcon, { color, emphasis, emphasisColor }) {
    const s = this.scene;
    // a line already showing fades out first, so two lines never sit on top of each other
    if (this.hintRow.alpha > 0.05) await tween(s, { targets: this.hintRow, alpha: 0, duration: 160 });
    this.hintRow.removeAll(true);
    const icon = s.add.graphics();
    icon.fillStyle(COLORS.panelNavyDeep, 1);
    icon.fillRoundedRect(0, 2, 34, 30, 6);
    drawIcon(icon);
    const style = { fontFamily: FONTS.body, fontSize: '23px', fontStyle: '600', color: toCss(color) };
    const part = { text, style };
    if (emphasis) Object.assign(part, { emphasis, emphasisStyle: { color: toCss(emphasisColor), fontStyle: '800' } });
    const t = new WordText(s, 84, 3, [part], { maxWidth: W - 130, highlight: '#ffffff' });
    this.hintRow.add([icon, t]);
    this.hintText = t;
    // the row grows if a line wraps
    const newH = BASE_H + Math.max(HINT_H, Math.round(t.textHeight + 14));
    if (this.height !== newH) {
      const st = { h: this.height };
      s.tweens.add({ targets: st, h: newH, duration: 260, ease: 'Cubic.easeOut', onUpdate: () => this.redraw(st.h) });
      this.height = newH;
    }
    this.hintRow.setAlpha(0);
    this.hintRow.x = 30;
    await tween(s, { targets: this.hintRow, alpha: 1, x: 40, duration: 300, delay: 120, ease: 'Cubic.easeOut' });
    // spoken as it appears, word by word
    return Narrator.say(t);
  }

  hideHint(instant = false) {
    // a hint must not keep talking once it is gone (e.g. the next attempt was right)
    if (this.hintText && Narrator.active?.wt === this.hintText) Narrator.stop();
    if (this.height === BASE_H) return;
    const from = this.height;
    this.height = BASE_H;
    if (instant) {
      this.hintRow.setAlpha(0);
      this.redraw(BASE_H);
      return;
    }
    const st = { h: from };
    this.scene.tweens.add({ targets: this.hintRow, alpha: 0, duration: 180 });
    this.scene.tweens.add({ targets: st, h: BASE_H, duration: 260, delay: 120, ease: 'Cubic.easeInOut', onUpdate: () => this.redraw(st.h) });
  }
}
