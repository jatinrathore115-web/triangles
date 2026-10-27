# Art Production Bible: Types of Triangles, Bridge Engineer

One unified style for every asset. When a production asset replaces a procedural placeholder,
it must follow this sheet. The placeholders in `src/systems/ProceduralArt.js` and the vector
components already obey these rules, so they're the reference for proportions and palette.

## 1. Style

Premium stylized low-poly / semi-3D construction adventure, for **older school students**.

- Clean stylized geometry, moderately chunky shapes, bevelled edges.
- Soft but dimensional lighting. **Key light is always upper-left**: lit faces point up-left,
  shaded faces point down-right. Never mix light directions.
- Subtle hand-painted surface variation: brushed steel, light wear, small scuffs. No heavy damage.
- A simplified, PBR-like impression of materials: steel reads as metal, timber as wood, stone as stone.
- Strong silhouettes, selective detail, readability first.
- Avoid: photorealism, preschool/cartoon proportions, flat classroom icons, oversaturated colour,
  clutter, and mixed perspectives.

## 2. Camera

A consistent **~3/4 game camera, presented side-on** for gameplay readability. The bridge is viewed
broadside so triangle geometry stays measurable. Props and terrain show a hint of top surface
(about 15–20° elevation). Never use orthographic flat icons beside perspective props.

## 3. Composition (16:9, 1920×1080 reference)

| Layer | Content | Rules |
|---|---|---|
| Background | sky, distant mountains, the two towns | atmospheric haze, low contrast, desaturated |
| Midground | river valley, cliffs, piers, bridge, crane | the bridge is the focal point and spans ~62% of the width |
| Foreground | frame yard, a few props at the edges | the centre of the yard stays clean for the frames |
| HUD | mission (top-left), progress (top-right), crane control (bottom-right) | never covers the bridge span or the slot |

Visual priority: bridge → active slot → triangle options → instruction → crane/environment → props.

## 4. Colour system (tokens live in `src/config/theme.js`)

| Group | Tokens |
|---|---|
| Environment | sky blue `#4f97d6 → #dcecf2`, water teal `#1f6f95 / #2f8fb5 / #5fb9d6`, stone `#b9a68e / #988670 / #6e6050`, muted vegetation `#79a54a / #5f8f4e` |
| Construction | warm yellow/orange `#f0b429 / #c98d14`, charcoal steel `#5d6b79 / #323c47`, dark blue-grey `#14263b`, wood `#a8743f / #7f5530` |
| Interaction | selected = gold rim `#ffc56b` + cyan inner line `#6fd8e6`; valid target = soft cyan/gold pulse; correct = teal `#3ec3a3` (flash); incorrect = amber/red `#e8743b / #d9583b` (flash) |
| Maths markings | paint orange `#ff7a3d` with dark outline `#2a1a10`; highlighted `#ffd27a` |

**Feedback colours flash and fade. They never permanently recolour the mathematical geometry.**

## 5. Mathematical markings (non-negotiable)

- Markings are generated from geometry in `TriangleFrame.js`. Production art must **not** bake them in.
- Side marks: sides with the same number of ticks are equal; different lengths always get different counts
  (equilateral 1/1/1, isosceles 1/1/2, scalene 1/2/3).
- Angle marks: an arc in every corner, a **square** for exactly 90°, and a **double arc** for an obtuse angle.
- Stamped cream plates show lengths (m) or angles (°). The readings are rounded, and the validator
  guarantees they never mislead (for example, a non-right angle can never read 90°).
- At gameplay scale, ticks must be at least 18 px long and plates at least 15 px text.

## 6. Asset prompts

### Environment
> Premium stylized low-poly bridge-construction game environment, wide 16:9 composition, large incomplete engineered bridge spanning a bright river valley, modular stone bridge pillars, steel and warm painted-metal construction elements, stylized rock cliffs and riverbanks, distant simplified architecture and mountains, clear blue sky, attractive soft atmospheric perspective, slightly hand-painted materials, bevelled game-ready geometry, sophisticated casual strategy game art, mature educational-game audience, strong visual hierarchy, clean playable central area, rich environment without clutter, polished lighting, no photorealism, no childish preschool aesthetic, no text, no UI.

Deliver as separate layers matching the manifest: `env.sky`, `env.mountains.far`, `env.hills.mid`,
`env.water`, `env.cliff.left`, `env.cliff.right`, `env.yard` (see the sizes in `assetManifest.js`).

### Bridge modular kit
> Modular stylized low-poly bridge construction asset kit, premium casual strategy game quality, structural steel beams, triangular truss modules, joints, bolts, connection sockets, deck sections, rails, bridge pillars and construction-state variants, slightly chunky refined geometry, bevelled edges, hand-painted metallic surface treatment, readable silhouettes, consistent proportions, medium detail, visually suitable for older students, clean game-ready assets, neutral lighting, isolated pieces, no text.

### Triangle frames (six variants, one construction language)
> Educational structural triangle frame designed as a premium game-world bridge component, stylized low-poly 3D steel construction frame, clear triangular silhouette, three visible beams connected with mechanical joints and bolts, mathematically precise proportions, educational side tick markings or angle markers integrated cleanly into the physical frame, strong readability at gameplay scale, refined metallic material, subtle painted accent, bevelled edges, soft studio lighting, sophisticated casual game aesthetic, not a classroom icon, transparent background, no text.

Variants: Isosceles · Equilateral · Scalene · Acute · Right · Obtuse. Production delivery is a
**beam texture + gusset plate + hex bolt** sprite set. Frames are assembled per edge in code, so any
proportions stay exact.

### Crane
> Stylized low-poly mobile construction crane for a premium educational bridge-building game, compact but believable mechanical design, warm yellow/orange painted metal, large readable shapes, hook and cable clearly visible, slightly hand-painted surface wear, bevelled geometry, appealing game proportions, sophisticated casual strategy game look, suitable for older students, modular animation-friendly boom, hook and cable, transparent background, no text.

Deliver as separate parts: mast/body, jib (or boom), trolley, hook block, cab. The cable is drawn in code.

### Construction props
> Cohesive set of stylized low-poly construction-site props for a premium bridge-building game: wooden crates, reinforced supply boxes, steel barrels, cable reels, stacked beams, tool cases, warning barriers, small scaffolding, bolts, stones and modular work-platform props, chunky refined silhouettes, soft bevels, subtle hand-painted textures, warm wood and metal palette, consistent 3/4 camera perspective, clean game-ready asset sheet, no excessive damage, no text, transparent background.

### Rocks / natural props
> Stylized low-poly modular rock and terrain prop set for a polished adventure/construction game, medium chunky geometry, layered angular stone forms, subtle hand-painted material variation, soft bevelled silhouettes, small moss accents on selected pieces, several size variations, sophisticated premium game asset style, consistent 3/4 perspective, isolated on transparent background, no realistic photography.

## 7. UI style

- Construction UI: metal plates, warm painted steel, dark navy/charcoal structure, cream plates
  where text must be read, small industrial accents (rivets, a hazard strip), modern type.
- Type: **Barlow Condensed** for headings/labels, **Barlow** for body text.
- Panels are compact. Bolts and brackets stay restrained, with no ornamental borders.
- Buttons (`ui/PlateButton.js`, `ui/CraneControls.js`): distinct hover (lighter + cream outline),
  pressed (darker, sinks 3 px) and disabled (charcoal, muted label) states.

## 8. Motion

Smooth easing everywhere (Sine/Cubic/Back), with no linear UI moves. Use anticipation and
follow-through: frames lift before they travel, snap with an overshoot, and the hook sways on a
damped pendulum. Camera feedback is tiny: 1.2% zoom breath and 0.16% shake on install. The cinematic
push is 7% at most. Ambient motion (water, clouds, beacon) is slow and low-contrast.

## 9. Audio palette

Short, low-volume, mechanical and warm: steel clanks, bolt ratchets, winch whine, welding crackle,
creak and sway, soft warning buzz (never a harsh alarm), a gentle rising chord for the final
assembly, and a tasteful fanfare for the bridge test. Every key is listed in `assetManifest.js` → `SOUNDS`.
