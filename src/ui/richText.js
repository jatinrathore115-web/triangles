// Minimal rich text: lays out words so an emphasised phrase can use a second colour.
// Returns a container whose children are Phaser Text objects.

import Phaser from 'phaser';

export function richText(scene, x, y, text, { emphasis = '', maxWidth = 600, style, emphasisStyle, lineHeight = 1.18 }) {
  const c = scene.add.container(x, y);
  const lower = text.toLowerCase();
  const eStart = emphasis ? lower.indexOf(emphasis.toLowerCase()) : -1;
  const eEnd = eStart + emphasis.length;

  // tokenise into words with emphasis flags
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) {
    const inE = eStart >= 0 && m.index >= eStart && m.index < eEnd;
    tokens.push({ word: m[0], em: inE });
  }

  const probe = scene.add.text(0, 0, ' ', style);
  const spaceW = probe.width;
  const lh = probe.height * lineHeight;
  probe.destroy();

  let cx = 0;
  let cy = 0;
  for (const t of tokens) {
    const obj = scene.add.text(0, 0, t.word, t.em ? { ...style, ...emphasisStyle } : style);
    if (cx > 0 && cx + obj.width > maxWidth) {
      cx = 0;
      cy += lh;
    }
    obj.setPosition(cx, cy);
    c.add(obj);
    cx += obj.width + spaceW;
  }
  c.textHeight = cy + lh;
  c.emphasisWords = c.list.filter((o, i) => tokens[i].em);
  return c;
}

export const isPhaserText = (o) => o instanceof Phaser.GameObjects.Text;
