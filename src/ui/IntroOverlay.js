// Opening briefing: why we are building, and the three-step interaction.
// BEGIN (the first user gesture) unlocks the voice; the story and the three steps are then
// spoken and revealed word by word. START BUILDING appears once the briefing has been heard.
// Tap the panel while a line is speaking to show it all; tap again to move on.

import Phaser from 'phaser';
import { COLORS, DEPTH, FONTS, GAME_HEIGHT, GAME_WIDTH, toCss } from '../config/theme.js';
import { COPY } from '../data/narration.js';
import { drawSteelPanel } from './plate.js';
import { PlateButton } from './PlateButton.js';
import { WordText } from './WordText.js';
import { Narrator } from '../systems/Narrator.js';
import { tween, wait } from '../utils/async.js';

const W = 1060;
const H = 560;

export class IntroOverlay {
  constructor(scene, { onBegin } = {}) {
    this.scene = scene;
    this.onBegin = onBegin;
  }

  show() {
    const s = this.scene;
    return new Promise((resolve) => {
      const scrim = s.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.panelNavyDeep, 0.55).setOrigin(0).setDepth(DEPTH.overlay).setInteractive();
      const root = s.add.container(GAME_WIDTH / 2 - W / 2, GAME_HEIGHT / 2 - H / 2 - 20).setDepth(DEPTH.overlay + 1);
      const bg = s.add.graphics();
      drawSteelPanel(bg, W, H, { hazardStrip: true });
      const kicker = s.add.text(60, 46, 'TYPES OF TRIANGLES', { fontFamily: FONTS.display, fontSize: '24px', fontStyle: '700', color: toCss(COLORS.selectCyan) });
      kicker.setLetterSpacing?.(4);
      const title = s.add.text(58, 74, 'BRIDGE ENGINEER', { fontFamily: FONTS.display, fontSize: '78px', fontStyle: '700', color: toCss(COLORS.textLight) });
      root.add([bg, kicker, title]);

      // the story: two narrated lines, words hidden until spoken
      const storyStyle = { fontFamily: FONTS.body, fontSize: '26px', fontStyle: '500', color: toCss(0xd6dee6) };
      const story = COPY.introStory.map((line, i) => new WordText(s, 60, 172 + i * 39, [{ text: line, style: storyStyle }], { maxWidth: W - 120, highlight: '#ffd27a' }));
      root.add(story);

      // the three steps: card frames visible (dimmed), their words spoken in turn
      const steps = COPY.introSteps.map(([a, b], i) => {
        const x = 60 + i * 320;
        const y = 290;
        const card = s.add.container(0, 0).setAlpha(0.35);
        const g = s.add.graphics();
        g.fillStyle(COLORS.panelNavyDeep, 1);
        g.fillRoundedRect(x, y, 296, 104, 10);
        g.lineStyle(2, COLORS.steel, 1);
        g.strokeRoundedRect(x, y, 296, 104, 10);
        g.fillStyle(COLORS.accent, 1);
        g.fillCircle(x + 40, y + 52, 22);
        const nt = s.add.text(x + 40, y + 52, String(i + 1), { fontFamily: FONTS.display, fontSize: '28px', fontStyle: '700', color: toCss(COLORS.textDark) }).setOrigin(0.5);
        const words = new WordText(
          s,
          x + 76,
          y + 26,
          [
            { text: a, style: { fontFamily: FONTS.body, fontSize: '22px', fontStyle: '700', color: toCss(COLORS.textLight) } },
            { text: b, style: { fontFamily: FONTS.body, fontSize: '19px', fontStyle: '500', color: toCss(COLORS.textMuted) }, gapBefore: 6 },
          ],
          { maxWidth: 210, lineHeight: 1.18, highlight: '#ffd27a' },
        );
        card.add([g, nt]);
        root.add([card, words]);
        return { card, words };
      });

      const keys = s.add.text(60, 462, 'Mouse / touch, or ← → to choose and Enter to place', { fontFamily: FONTS.body, fontSize: '19px', color: toCss(COLORS.textMuted) });
      root.add(keys);

      let phase = 'idle'; // idle -> briefing -> ready
      let current = null; // narration handle of the line being spoken
      let tapState = 0; // 0 = speaking, 1 = text shown (next tap skips)
      let skipLine = null;

      const btn = new PlateButton(s, { x: W - 60 - 150, y: H - 70, width: 300, height: 68, label: 'BEGIN', onPress: () => press() });
      root.add(btn.root);

      // tapping the panel while a line speaks: show all of it; tap again: move on
      bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
      bg.on('pointerup', () => tap());
      const tap = () => {
        if (phase !== 'briefing' || !current) return;
        if (tapState === 0) {
          current.finishText();
          tapState = 1;
        } else skipLine?.();
      };

      const speak = async (wt) => {
        tapState = 0;
        current = Narrator.say(wt);
        await Promise.race([current.done, new Promise((r) => (skipLine = r))]);
        Narrator.stop();
        wt.showAll();
        current = null;
      };

      const briefing = async () => {
        phase = 'briefing';
        s.introPhase = phase;
        btn.root.setVisible(false);
        for (const wt of story) await speak(wt);
        for (const st of steps) {
          tween(s, { targets: st.card, alpha: 1, duration: 260 });
          await wait(s, 120);
          await speak(st.words);
        }
        phase = 'ready';
        s.introPhase = phase;
        btn.setLabel('START BUILDING');
        btn.root.setVisible(true).setAlpha(0).setScale(0.94);
        tween(s, { targets: btn.root, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
      };

      const press = () => {
        if (phase === 'idle') {
          // first user gesture: unlock the voice, then brief
          this.onBegin?.();
          briefing();
        } else if (phase === 'ready') finish();
      };

      root.alpha = 0;
      root.y += 20;
      tween(s, { targets: root, alpha: 1, y: root.y - 20, duration: 420, ease: 'Cubic.easeOut' });

      const keyHandler = () => (phase === 'briefing' ? tap() : press());
      s.input.keyboard.on('keydown-ENTER', keyHandler);
      let done = false;
      const finish = async () => {
        if (done) return;
        done = true;
        Narrator.stop();
        s.input.keyboard.off('keydown-ENTER', keyHandler);
        await Promise.all([tween(s, { targets: root, alpha: 0, y: root.y + 16, duration: 300 }), tween(s, { targets: scrim, alpha: 0, duration: 300 })]);
        root.destroy();
        scrim.destroy();
        resolve();
      };
    });
  }
}
