// Concept reinforcement after a correct placement, narrated as ONE line:
//   "PERFECT FIT · SECTION 1 OF 6" / "Isosceles Triangle" / "Exactly 2 equal sides." /
//   "Two sides are 8 m and one is 6 m."   (praise + progress, type, rule, why THIS frame fits)
// A leader line ties the card to the frame that was just bolted in.

import { COLORS, DEPTH, FONTS, toCss } from '../config/theme.js';
import { drawSteelPanel } from './plate.js';
import { tween, wait } from '../utils/async.js';
import { WordText } from './WordText.js';
import { Narrator } from '../systems/Narrator.js';

const BOTTOM = 1058; // the card never runs off the bottom of the 1080-high stage

export class ReinforcementCard {
  constructor(scene) {
    this.scene = scene;
    this.root = scene.add.container(0, 0).setDepth(DEPTH.ui - 5).setVisible(false);
    this.leader = scene.add.graphics().setDepth(DEPTH.ui - 6);
  }

  async show({ kicker, title, body, why }, { x, y, anchor, flip = false, leaderFromTop = false }) {
    const s = this.scene;
    this.root.removeAll(true);
    // every part forms ONE narrated line, revealed word by word as it is spoken
    const parts = [];
    if (kicker) parts.push({ text: kicker, style: { fontFamily: FONTS.display, fontSize: '19px', fontStyle: '700', color: toCss(COLORS.correctTeal) }, letterSpacing: 2 });
    parts.push({ text: title, style: { fontFamily: FONTS.display, fontSize: '38px', fontStyle: '700', color: toCss(COLORS.textLight) }, gapBefore: kicker ? 2 : 0 });
    parts.push({ text: body, style: { fontFamily: FONTS.body, fontSize: '25px', fontStyle: '600', color: toCss(COLORS.accentWarm) } });
    if (why) parts.push({ text: why, style: { fontFamily: FONTS.body, fontSize: '22px', fontStyle: '500', color: toCss(COLORS.textLight) }, gapBefore: 4 });
    const words = new WordText(s, 26, 18, parts, { maxWidth: 560, lineHeight: 1.12, highlight: '#ffd27a' });
    const w = words.textWidth + 54;
    const h = Math.max(112, Math.round(words.textHeight + 30));
    y = Math.min(y, BOTTOM - h);
    const bg = s.add.graphics();
    drawSteelPanel(bg, w, h);
    this.root.add([bg, words]);
    if (flip) x = x + 420 - w; // right-align when the card sits left of the frame
    this.root.setPosition(x, y).setVisible(true).setAlpha(0);
    this.size = { w, h };

    // leader from the card to the frame it describes
    const start = leaderFromTop ? { x: Math.min(Math.max(anchor.x, x + 30), x + w - 30), y } : { x: flip ? x + w : x, y: y + h / 2 };
    this.leader.clear();
    this.leader.lineStyle(3, COLORS.accentWarm, 0.95);
    this.leader.lineBetween(start.x, start.y, anchor.x, anchor.y);
    this.leader.fillStyle(COLORS.accentWarm, 1);
    this.leader.fillCircle(anchor.x, anchor.y, 5);
    this.leader.setAlpha(0);

    this.root.y = y + 14;
    await Promise.all([
      tween(s, { targets: this.root, alpha: 1, y, duration: 320, ease: 'Cubic.easeOut' }),
      tween(s, { targets: this.leader, alpha: 1, duration: 320, delay: 120 }),
    ]);
    // resolves once the voice has finished, so CONTINUE only appears after the explanation
    await Narrator.say(words).done;
    // a short beat to take the explanation in before CONTINUE lights up
    await wait(s, 300);
  }

  hide() {
    return Promise.all([
      tween(this.scene, { targets: this.root, alpha: 0, duration: 220 }),
      tween(this.scene, { targets: this.leader, alpha: 0, duration: 220 }),
    ]).then(() => this.root.setVisible(false));
  }
}
