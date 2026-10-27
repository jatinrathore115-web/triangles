# Bridge Engineer: Types of Triangles

An educational bridge-building game (Phaser 3 + Vite, JavaScript). The player reads triangle
markings, picks the right structural frame, and uses a crane to install it. Six missions build six
different structural areas of one truss bridge, which is then load-tested by a vehicle.

**To play:** click **Go Live** in VS Code (Live Server), double-click `PLAY-GAME.bat` (it starts
the dev server and opens the browser), or open `dist/BridgeEngineer.html` directly, a
self-contained file that works offline from disk. The source `index.html` only runs under the Vite
dev server; opened from disk or a static server (Live Server) it forwards to the standalone build,
so run `npm run build` after changing `src/` to refresh what Live Server shows.

    npm install
    npm start          # dev server + opens the browser (http://localhost:5199)
    npm run dev        # dev server only
    npm run build      # dist/ + standalone dist/BridgeEngineer.html
    npm run validate   # every answer key + angle reading checked against the geometry
    npm run qa         # (dev server running) full headless play-through + screenshots in ./qa-shots
    npm run build

## Flow
Intro briefing → Stage 1 (sides): isosceles, equilateral, scalene → short checkpoint →
Stage 2 (angles): acute, right, obtuse → final construction sequence → bridge load test →
Structural Report (rating 1–3 stars) → Build again.

Controls: click a frame (or press Left/Right), then PLACE ON BRIDGE, a click on the glowing slot, or Enter/Space.

## Structure
- `src/data`: missions, frame catalogue, bridge layout (panels per stage), asset manifest, validator
- `src/systems`: mission, placement, feedback, hints, scoring, checkpoint, finale, audio, FX, procedural art
- `src/components`: bridge, crane, triangle frame, yard, environment, vehicle, people
- `src/ui`: mission/progress panels, crane control, reinforcement card, banner, intro, structural report
- `docs/ART_BIBLE.md`: the unified art direction; `ASSETS.md`: how to swap in production art
