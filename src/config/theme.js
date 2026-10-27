// Design tokens for the bridge-builder world.
// Every visual system reads from here so art direction can be tuned in one place.

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;

export const FONTS = {
  display: '"Barlow Condensed", "Arial Narrow", sans-serif',
  body: '"Barlow", "Segoe UI", sans-serif',
};

export const COLORS = {
  // Sky & atmosphere
  skyTop: 0x4f97d6,
  skyMid: 0x8cc3ea,
  skyHorizon: 0xdcecf2,
  haze: 0xe8f1f2,

  // Terrain
  mountainFar: 0x9bb6cc,
  mountainFarShade: 0x88a4bd,
  mountainMid: 0x6f9a8c,
  mountainMidShade: 0x5c8577,
  hillNear: 0x5f8f4e,
  hillNearShade: 0x4c7a3f,
  grass: 0x79a54a,
  grassShade: 0x5e8a39,
  rockLight: 0xb9a68e,
  rockMid: 0x988670,
  rockDark: 0x6e6050,
  rockDeep: 0x4d4338,
  dirt: 0xa98a63,
  dirtShade: 0x8a6f4d,

  // Water
  waterDeep: 0x1f6f95,
  waterMid: 0x2f8fb5,
  waterLight: 0x5fb9d6,
  waterFoam: 0xd9f1f5,

  // Construction materials
  steel: 0x5d6b79,
  steelLight: 0x93a3b2,
  steelHighlight: 0xc6d2dc,
  steelDark: 0x323c47,
  steelEdge: 0x1f262e,
  bolt: 0xd3dbe2,
  boltShade: 0x7b8793,
  rust: 0x8c5a3c,
  concrete: 0xa7a29a,
  concreteShade: 0x837e76,
  concreteDark: 0x625e58,
  timber: 0xa8743f,
  timberShade: 0x7f5530,
  craneYellow: 0xf0b429,
  craneYellowShade: 0xc98d14,
  craneYellowDark: 0x8f620c,
  hazard: 0xf2b134,
  hazardDark: 0x22262b,

  // UI
  panelNavy: 0x14263b,
  panelNavyDeep: 0x0d1b2b,
  panelEdge: 0x5d6b79,
  panelPlate: 0xf3ead8,
  panelPlateShade: 0xdccfb5,
  textLight: 0xf6f1e6,
  textDark: 0x1b2633,
  textMuted: 0x9fb0c0,
  accent: 0xf2b134,
  accentWarm: 0xffc56b,

  // Mathematical markings (painted onto frames, must stay readable)
  marking: 0xff7a3d,
  markingOutline: 0x2a1a10,
  markingPulse: 0xffd27a,

  // Interaction (selected = cyan/gold, valid target = cyan/gold pulse,
  // correct = teal, incorrect = amber/red). Feedback colours flash, never persist on maths.
  selectCyan: 0x6fd8e6,
  correctTeal: 0x3ec3a3,
  incorrectRed: 0xd9583b,
  lampWarm: 0xffe3a3,

  // Feedback (never pure red / green: behaviour carries the meaning)
  glowWarm: 0xffc56b,
  warn: 0xe8743b,
  spark: 0xffe2a0,
  dust: 0xcdb89a,
};

export const toCss = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

// Draw-order bands. Keep gameplay readable: background < bridge < crane < inventory < UI.
export const DEPTH = {
  sky: 0,
  farTerrain: 10,
  midTerrain: 20,
  water: 30,
  bankFar: 40,
  bridgeBack: 50,
  bridge: 60,
  vehicle: 56,
  bridgeFx: 70,
  crane: 80,
  foreground: 90,
  inventory: 100,
  carried: 110,
  fx: 120,
  workers: 75,
  ui: 200,
  overlay: 300,
};

export const TIMING = {
  hoverLift: 140,
  selectLift: 220,
  trolleyPxPerMs: 1.6, // crane travel speed: short and snappy
  minTravel: 260,
  maxTravel: 700,
  hookDrop: 360,
  snap: 260,
};
