// Shared "steel signboard" drawing for HUD panels so every panel reads as a piece of
// site equipment rather than a flat web card.

import { COLORS } from '../config/theme.js';
import { shade } from '../systems/ProceduralArt.js';

export function drawSteelPanel(g, w, h, { radius = 10, hazardStrip = false, fill = COLORS.panelNavy } = {}) {
  g.clear();
  // drop shadow
  g.fillStyle(0x000000, 0.28);
  g.fillRoundedRect(4, 7, w, h, radius);
  // outer steel frame
  g.fillStyle(COLORS.steelEdge, 1);
  g.fillRoundedRect(0, 0, w, h, radius);
  g.fillStyle(COLORS.steel, 1);
  g.fillRoundedRect(2, 2, w - 4, h - 4, radius - 1);
  g.fillStyle(shade(COLORS.steel, 0.35), 1);
  g.fillRoundedRect(4, 3, w - 8, 3, 2);
  // inset face
  g.fillStyle(shade(fill, -0.25), 1);
  g.fillRoundedRect(7, 7, w - 14, h - 14, radius - 4);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(8, 9, w - 16, h - 17, radius - 4);
  // faint brushed sheen
  g.fillStyle(0xffffff, 0.04);
  g.fillRoundedRect(8, 9, w - 16, (h - 17) * 0.45, { tl: radius - 4, tr: radius - 4, bl: 0, br: 0 });

  if (hazardStrip) {
    const x0 = 8;
    const sw = 12;
    g.fillStyle(COLORS.hazard, 1);
    g.fillRect(x0, 9, sw, h - 17);
    g.fillStyle(COLORS.hazardDark, 1);
    for (let y = 2; y < h - 17; y += 18) {
      g.fillTriangle(x0, 9 + y, x0 + sw, 9 + y - 9, x0 + sw, 9 + y);
      g.fillTriangle(x0, 9 + y, x0 + sw, 9 + y, x0, 9 + y + 9);
    }
  }

  // corner rivets
  const left = hazardStrip ? 30 : 14;
  const r = [
    [left, 14],
    [w - 14, 14],
    [left, h - 14],
    [w - 14, h - 14],
  ];
  for (const [x, y] of r) {
    g.fillStyle(COLORS.steelEdge, 1);
    g.fillCircle(x + 0.8, y + 0.8, 3.4);
    g.fillStyle(COLORS.steelLight, 1);
    g.fillCircle(x, y, 3);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(x - 1, y - 1, 1.1);
  }
}

export function drawTag(g, w, h, color = COLORS.accent) {
  g.clear();
  g.fillStyle(shade(color, -0.45), 1);
  g.fillRoundedRect(0, 1.5, w, h, 4);
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, w, h, 4);
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(2, 1, w - 4, h * 0.38, 3);
}
