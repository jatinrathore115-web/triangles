# Asset pipeline

Art direction for every asset is defined in [docs/ART_BIBLE.md](docs/ART_BIBLE.md).

All art and audio is resolved through `src/data/assetManifest.js`. Gameplay code only uses
logical keys (`env.sky`, `sfx.clank`, ...), never file names.

## Swapping in production art
1. Export the file at the size listed in the manifest entry (`size: [w, h]`).
2. Put it in the matching folder under `/assets/` (environments, bridge, construction, fx, audio...).
3. Set `path: 'assets/<folder>/<file>.png'` on the entry. BootScene loads it, and the procedural
   placeholder is skipped automatically.

Anchors used by layout code:
- `env.cliff.left` / `env.cliff.right`: grass top at y=50 / y=60 inside the image. The bridge
  abutments sit on that line.
- `bridge.pillar`: top-centre anchor, cap at the top 34 px.
- `prop.*`: bottom-centre anchor (they stand on the ground/deck).

## Vector components (not in the texture manifest)
These animate per part, so they're drawn in code today:
- `src/components/Crane.js`: mast, jib, trolley, hook block. Replace with a sprite set
  (static body + trolley + hook block + cab) and keep `hookTip`, `trolleyY`, `layout`.
- `src/components/TriangleFrame.js`: beam, gusset, bolt and marking layers. Production art can
  replace the beam/gusset drawing (for example a 9-slice beam texture stretched per edge), but the
  **tick marks and length plates must stay generated from geometry** so the maths can't drift.
- `src/ui/*`: HUD plates. Replace `drawSteelPanel` / `drawTag` / `drawHazardPlate` with 9-slice textures.
- `src/components/Vehicle.js`: test vehicle (body + 2 wheel sprites; keep the wheel radius).
- `src/components/People.js`: workers and townspeople (body + waving arm sprites).

## Audio
`SOUNDS` entries fall back to WebAudio synth recipes in `src/systems/AudioSystem.js`.
Set `path` to use a recorded file instead.
