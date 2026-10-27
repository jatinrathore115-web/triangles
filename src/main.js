import Phaser from 'phaser';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow/latin-800.css';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config/theme.js';
import { BootScene } from './scenes/BootScene.js';
import { BuildScene } from './scenes/BuildScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.panelNavyDeep,
  scale: {
    mode: Phaser.Scale.FIT, // locked 16:9, letterboxed on other aspect ratios
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, BuildScene],
});

window.__game = game;

// Keep pointer -> game coordinate mapping exact. If the canvas moves without a resize
// (window restored, moved between monitors, DPI or zoom change), stale bounds would make
// clicks land in the wrong place, so re-measure whenever that can happen.
const refreshScale = () => game.isBooted && game.canvas && game.scale.refresh();
window.addEventListener('focus', refreshScale);
window.addEventListener('load', refreshScale);
document.addEventListener('visibilitychange', refreshScale);
window.addEventListener('pointerdown', () => game.isBooted && game.canvas && game.scale.updateBounds(), { capture: true });
if (window.ResizeObserver) new ResizeObserver(refreshScale).observe(document.getElementById('game'));
document.fonts?.ready.then(refreshScale);
