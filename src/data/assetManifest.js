// Asset manifest: the single source of truth for every texture and sound the game uses.
//
// Each entry has a logical key (what gameplay code asks for) and EITHER:
//   path      -> production file, loaded by BootScene when present
//   generator -> procedural placeholder produced by systems/ProceduralArt.js
//
// To swap in production art, drop the file into /assets/<folder>/ and set `path`.
// Gameplay code never references file names or generators directly.
// Image entries must keep the listed size (or the documented anchor) so layouts hold.

export const TEXTURES = {
  // environments/
  'env.sky': { generator: 'sky', size: [1920, 1080], path: null },
  'env.mountains.far': { generator: 'mountainsFar', size: [1920, 520], path: null },
  'env.hills.mid': { generator: 'hillsMid', size: [1920, 420], path: null },
  'env.cliff.left': { generator: 'cliffLeft', size: [420, 520], path: null },
  'env.cliff.right': { generator: 'cliffRight', size: [560, 520], path: null },
  'env.water': { generator: 'water', size: [1920, 300], path: null },
  'env.yard': { generator: 'yard', size: [1920, 260], path: null },
  'env.cloud.a': { generator: 'cloudA', size: [360, 130], path: null },
  'env.cloud.b': { generator: 'cloudB', size: [260, 100], path: null },
  'env.tree': { generator: 'tree', size: [60, 110], path: null },

  // bridge/
  'bridge.pillar': { generator: 'pillar', size: [120, 195], path: null },
  'bridge.abutment.left': { generator: 'abutmentLeft', size: [150, 150], path: null },
  'bridge.abutment.right': { generator: 'abutmentRight', size: [150, 150], path: null },

  // construction/
  'prop.cone': { generator: 'cone', size: [44, 56], path: null },
  'prop.beams': { generator: 'beamStack', size: [200, 80], path: null },
  'prop.crate': { generator: 'crate', size: [90, 80], path: null },
  'prop.pallet': { generator: 'pallet', size: [220, 34], path: null },
  'prop.barrier': { generator: 'barrier', size: [120, 46], path: null },

  // fx/
  'fx.spark': { generator: 'spark', size: [16, 16], path: null },
  'fx.dust': { generator: 'dust', size: [64, 64], path: null },
  'fx.glow': { generator: 'glow', size: [256, 256], path: null },
  'fx.shimmer': { generator: 'shimmer', size: [180, 10], path: null },
};

// Crane, triangle frames and HUD panels are vector components (src/components, src/ui)
// because they animate per-part. Production sprite sheets can replace their internal
// drawing without touching gameplay systems: see ASSETS.md.

export const SOUNDS = {
  'sfx.hover': { synth: 'hover', path: null },
  'sfx.select': { synth: 'select', path: null },
  'sfx.motor': { synth: 'motor', path: null },
  'sfx.hookAttach': { synth: 'hookAttach', path: null },
  'sfx.clank': { synth: 'clank', path: null },
  'sfx.bolt': { synth: 'bolt', path: null },
  'sfx.sparks': { synth: 'sparks', path: null },
  'sfx.assemble': { synth: 'assemble', path: null },
  'sfx.reject': { synth: 'reject', path: null },
  'sfx.creak': { synth: 'creak', path: null },
  'sfx.progress': { synth: 'progress', path: null },
  'sfx.release': { synth: 'release', path: null },
  'sfx.cable': { synth: 'cable', path: null },
  'sfx.pickup': { synth: 'pickup', path: null },
  'sfx.weld': { synth: 'weld', path: null },
  'sfx.wobble': { synth: 'wobble', path: null },
  'sfx.checkpoint': { synth: 'checkpoint', path: null },
  'sfx.complete': { synth: 'complete', path: null },
  'sfx.barrier': { synth: 'barrier', path: null },
  'sfx.vehicle': { synth: 'vehicle', path: null },
  'sfx.horn': { synth: 'horn', path: null },
  'music.rise': { synth: 'rise', path: null },
  'music.success': { synth: 'success', path: null },
  // looping beds (AudioSystem.startAmbience synthesises these until files are supplied)
  'amb.water': { synth: null, path: null, loop: true },
  'amb.construction': { synth: null, path: null, loop: true },
};

// Additional textures for the finale.
TEXTURES['fx.confetti'] = { generator: 'confetti', size: [10, 6], path: null };
