// Short construction checkpoint between stages (data: mission.checkpoint).
// Highlights the installed frames of each type with a compact spec tag. ~5 seconds,
// never a long educational screen.

import { COLORS, DEPTH, FONTS, toCss } from '../config/theme.js';
import { TRIANGLE_TYPES } from '../data/triangleFrames.js';
import { panelsForStage } from '../data/bridgeLayout.js';
import { tween, wait } from '../utils/async.js';
import { COPY } from '../data/narration.js';
import { WordText } from '../ui/WordText.js';
import { Narrator } from './Narrator.js';

const ROWS = [690, 770, 690]; // staggered so neighbouring tags never collide

export class CheckpointSystem {
  constructor(scene, { bridge, banner, audio }) {
    Object.assign(this, { scene, bridge, banner, audio });
  }

  async run(cp) {
    const s = this.scene;
    // the banner is spoken first; each tag then appears and is spoken in turn
    await this.banner.show({ title: cp.title, subtitle: cp.subtitle, y: 940, keep: true, accent: COLORS.selectCyan });
    await wait(s, 200);
    const tags = [];
    for (let i = 0; i < cp.items.length; i++) {
      const item = cp.items[i];
      const info = TRIANGLE_TYPES[item.stage];
      const ids = panelsForStage(item.stage).map((p) => p.id);
      this.bridge.glowPanels(ids, { tint: 0xc8f4ff, peak: 0.6 });
      ids.forEach((id) => {
        const f = this.bridge.panels.get(id);
        f?.flashRim(COLORS.selectCyan, 600);
        f?.pulseHighlight(item.stage === 'scalene' ? 'allSides' : 'equalSides', { repeat: 1, scale: 1.45, duration: 240 });
      });
      const tag = this.makeTag(item, info, ROWS[i % ROWS.length]);
      tags.push(tag);
      this.audio.play('sfx.checkpoint');
      await wait(s, 200);
      await Narrator.say(tag.words).done;
      await wait(s, 150);
    }
    await wait(s, 700);
    await Promise.all([...tags.map((t) => tween(s, { targets: t, alpha: 0, duration: 300 })), this.banner.hide()]);
    tags.forEach((t) => t.destroy());
    if (cp.next) await this.banner.show({ title: cp.next, subtitle: COPY.stage2Subtitle, y: 940, hold: 700, accent: COLORS.selectCyan });
  }

  makeTag(item, info, y) {
    const s = this.scene;
    const anchor = this.bridge.panelBottomWorld(item.panel);
    const c = s.add.container(anchor.x, y).setDepth(DEPTH.ui - 4);
    const words = new WordText(
      s,
      0,
      -31,
      [
        { text: info.short.toUpperCase(), style: { fontFamily: FONTS.display, fontSize: '28px', fontStyle: '700', color: toCss(COLORS.textLight) }, letterSpacing: 2 },
        { text: info.spec, style: { fontFamily: FONTS.body, fontSize: '19px', fontStyle: '700', color: toCss(COLORS.accentWarm) } },
      ],
      { align: 'center', maxWidth: 400, lineHeight: 1.08, highlight: '#ffd27a' },
    );
    const w = words.textWidth + 36;
    const g = s.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(-w / 2 + 3, -36 + 5, w, 74, 8);
    g.fillStyle(COLORS.panelNavy, 0.96);
    g.fillRoundedRect(-w / 2, -36, w, 74, 8);
    g.lineStyle(2, COLORS.selectCyan, 0.9);
    g.strokeRoundedRect(-w / 2, -36, w, 74, 8);
    // leader up to the deck underside
    const lead = s.add.graphics();
    lead.lineStyle(2, COLORS.selectCyan, 0.8);
    lead.lineBetween(0, -36, 0, anchor.y + 52 - y);
    lead.fillStyle(COLORS.selectCyan, 1);
    lead.fillCircle(0, anchor.y + 52 - y, 4);
    c.add([lead, g, words]);
    c.words = words;
    c.alpha = 0;
    c.y += 12;
    tween(s, { targets: c, alpha: 1, y, duration: 320, ease: 'Back.easeOut' });
    return c;
  }
}

