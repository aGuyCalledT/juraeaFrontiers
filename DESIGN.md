---
name: Juräa Frontiers
description: A cartoony Risk-style conquest game played on chunky cardboard hex tiles floating in a teal sea.
colors:
  ink: "#2b1d14"
  wood-light: "#d0904f"
  wood-mid: "#a8692f"
  wood-dark: "#87501f"
  wood-edge: "#5a3214"
  stained-wood-light: "#8a5428"
  stained-wood-mid: "#6e401c"
  stained-wood-dark: "#573214"
  stone-light: "#cfc8bb"
  stone-mid: "#a49c8f"
  stone-edge: "#6b6358"
  go-light: "#8fe05a"
  go-mid: "#4f9e2b"
  go-edge: "#2f6b17"
  gold: "#ffd23f"
  gold-deep: "#e0a21c"
  cream: "#fff4dc"
  parchment: "#ffe8c2"
  label-tan: "#ffe1ad"
  danger: "#ff5a3c"
  sea-shallow: "#4ccfcf"
  sea-mid: "#24a3ad"
  sea-deep: "#136a80"
  felt: "#1f5631"
  plains: "#9ccf45"
  forest: "#4f9a3a"
  mountain: "#a7a096"
  desert: "#f0cb6b"
  necro-violet: "#8e4fc4"
  necro-dark: "#4a2370"
  necro-toxic: "#8dff5a"
  elves-gold: "#f0b928"
  elves-dark: "#8a5b08"
  elves-leaf: "#5fd35a"
  giants-crimson: "#e0452f"
  giants-dark: "#7c1a10"
  giants-ember: "#ffb02e"
  wildlands: "#b9a88f"
typography:
  display:
    fontFamily: "Lilita One, Fredoka, system-ui, sans-serif"
    fontSize: "clamp(44px, 8vw, 78px)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Lilita One, Fredoka, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.05
  title:
    fontFamily: "Lilita One, Fredoka, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.05
  button:
    fontFamily: "Lilita One, Fredoka, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  numeral:
    fontFamily: "Lilita One, Fredoka, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Fredoka, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body-strong:
    fontFamily: "Fredoka, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  label:
    fontFamily: "Fredoka, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "14px"
  lg: "18px"
  xl: "24px"
components:
  button-wood:
    backgroundColor: "{colors.wood-light}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "48px"
  button-go:
    backgroundColor: "{colors.go-light}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "48px"
  button-primary-phase:
    backgroundColor: "{colors.go-light}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "12px 30px"
    height: "64px"
  button-primary-phase-waiting:
    backgroundColor: "{colors.gold}"
    textColor: "#ffffff"
  button-stone-ghost:
    backgroundColor: "#8b7a68"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "48px"
  button-small:
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "38px"
  icon-button-stone:
    backgroundColor: "{colors.stone-mid}"
    rounded: "{rounded.pill}"
    size: "46px"
  segment-on:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "36px"
  chip:
    backgroundColor: "#5e5044"
    textColor: "{colors.cream}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: "6px 11px"
    height: "34px"
  chip-on:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.cream}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  plank-panel:
    backgroundColor: "{colors.stained-wood-mid}"
    textColor: "{colors.parchment}"
    padding: "22px 24px 26px"
  ability-card:
    backgroundColor: "#b77a42"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 6px"
    width: "104px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  tooltip:
    backgroundColor: "#6e4420"
    textColor: "#f6e6c8"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    width: "270px"
  die:
    rounded: "13px"
    size: "54px"
---

# Design System: Juräa Frontiers

## Overview

**Creative North Star: "The Carved Tabletop"**

Juräa Frontiers is a board game you could pick up: chunky cardboard hex tiles with visible thickness, floating on a cartoon teal sea, framed by carved wooden planks with iron rivets and round stone buttons. Everything is drawn in code as SVG, and every shape carries the same thick dark-umber outline, so the board art, the faction crests, the icons and the HUD read as one hand-inked object. The register is Catan's tabletop crossed with Kingdom Rush's chunky cartoon: saturated, friendly, never grim, even when the subject is necromancers.

The board is the screen. The HUD floats over it as a few physical objects (a wooden top plank, a player ledger, a tray of ability cards, one big green phase button), each with an extruded edge that sits it on the table. Reading surfaces (panels, modals, tooltips) are dark-stained wood so cream text holds its contrast; action surfaces are light wood, grass-green or stone. Faction colour does the identifying work everywhere: tile rings, crests, flags, dice, the ribbon banner, the active phase pill.

Motion is staged, physical and springy. Tiles drop and squash into place, badges pop with overshoot, banners swing in on a bounce and fly out with an ease-in, dice tumble, slam, and resolve. Every timing flows through one speed scalar and every animation stops under reduced motion.

**Key Characteristics:**
- One ink: dark umber (#2b1d14) outlines on every drawn shape, 2.4 to 5 units in SVG, 2 to 4px in CSS.
- Three materials: carved wood (frames, primary surfaces), speckled stone (secondary controls, resource plaques), and painted cardboard (tiles).
- Extruded edges, not floating shadows: every raised object shows its own darker underside, then a soft sea-blue ambient shadow.
- Display type is Lilita One with a stamped ink outline; UI type is Fredoka.
- Saturated terrain and faction colours over a teal radial sea.

## Colors

A saturated cartoon palette held together by one umber ink, with wood and stone as the neutrals and the sea as the canvas.

### Primary
- **Grass Go Green** (go-light to go-mid, edge go-edge): the colour of committing. The primary phase button and confirm buttons ("Begin the conquest") wear it, a top-lit gradient over a dark-green extruded edge.
- **Coin Gold** (gold, gold-deep): selection and value. Selected segment, active chip, armed card halo, selected-tile ring, die bonus, slider thumb, gold coin icon, the "waiting" state of the phase button, text selection.

### Secondary
- **Carved Wood** (wood-light, wood-mid, wood-dark, edge wood-edge): default frame and default button material, laid as a three-stop vertical gradient with drawn grain lines and plank seams.
- **Stained Wood** (stained-wood-light/mid/dark): the same plank re-stained dark for reading surfaces (setup, help, online panels, modals) so text keeps contrast.
- **Speckled Stone** (stone-light, stone-mid, edge stone-edge): round icon buttons, resource plaques, inactive phase steps, ghost buttons.

### Tertiary
- **Faction colours**, each a main/dark/accent triad: Death Cults necro-violet with necro-toxic green; Evergarden elves-gold with elves-leaf; Giants giants-crimson with giants-ember; unclaimed Wildlands in wildlands tan. Main drives rings, crests, flags, bars and dice; dark is the extruded edge and banner tail; accent is the glow detail (soul eyes, leaves, ember studs).
- **Terrain** (plains, forest, mountain, desert): tile tops, each with a lighter highlight and two darker side tones in the board code. Mountains carry white snow caps; desert carries dunes, cacti and bones.
- **Felt** (felt, lit to #2f7a45 at the top): the green baize inside the dice tray, inset in a wood rim.
- **Danger Red** (danger): attack targets (dashed ring), crossed-out lost dice. Loss floats use a softer #ff7059, gain floats #a6ff6e.

### Neutral
- **Umber Ink** (ink): every outline, button text outline, translucent HUD backing (toasts at 0.9, hint bar at 0.82), input text.
- **Cream** (cream): body text on dark wood, input fill, chip text.
- **Parchment** (parchment): secondary text on wood (subtitles, stats, tooltip heads).
- **Label Tan** (label-tan): small uppercase control labels.
- **Teal Sea** (sea-shallow to sea-mid to sea-deep): the page background, a radial gradient lit from the board's centre, with lapping white coast dashes and foam.

### Named Rules
**The One Ink Rule.** Every drawn shape, CSS or SVG, is outlined in Umber Ink (#2b1d14). Never pure black, never a faction colour, never omitted on a raised object.

**The Faction Owns the Colour Rule.** Violet, gold and crimson mean a faction and nothing else. Generic UI never borrows them; UI emphasis uses Coin Gold or Grass Go Green.

**The Dark Stain Rule.** Any wood surface that carries paragraphs is stained dark; light wood carries only display-type labels with an ink outline.

## Typography

**Display Font:** Lilita One (with Fredoka, system-ui)
**Body Font:** Fredoka 500/600 (with system-ui)

**Character:** Lilita One is a fat, friendly poster face that reads like carved or painted signage; it is always white or gold with an ink stroke stamped around it. Fredoka is rounded and soft, carrying everything you read rather than glance at.

### Hierarchy
- **Display** (400, clamp(44px, 8vw, 78px), 0.95): the hanging title sign only. White with the full outline plus an 8px ink drop; the second line in gold at 0.62em, tracked 0.08em.
- **Headline** (400, 32px, 1.05; 27px under 760px): panel and modal titles, white with full outline. Banner ribbon titles go to 36px (26px mobile); the troop-amount readout to 58px.
- **Title** (400, 24px, 1.05): turn name, big buttons, the phase button. Faction card names at 23px, help heads at 20px.
- **Button** (400, 19px, 1, 0.02em): all standard buttons, white with the small outline.
- **Numeral** (400, 20px, tabular): resource counts, badge numbers on tiles (21px, ink stroke 5), float numbers (30px, ink stroke 7).
- **Body** (500, 16px, 1.4): panel copy, hint bar; help paragraphs capped at 62ch.
- **Body Strong** (600, 14 to 15px, 1 to 1.35): chips, segments, toasts, tooltips, stat rows.
- **Label** (600, 13px, 0.08em, uppercase): control and field labels ("Map size", input labels, stats headers at 12px). Labels name a control; they never sit above a heading as decoration.

### Named Rules
**The Stamped Outline Rule.** Display type on any coloured or wooden surface carries the ink outline text-shadow (small: 1.5px ring plus 2.5px drop; full: 2px ring plus 4px drop). Fredoka body text never does.

**The Tabular Count Rule.** Every number that changes during play (resources, troops, stats, amounts) is tabular.

## Layout

The board is the layout: it fills the viewport, pans and zooms, and HUD objects float over it pinned to the edges, respecting safe-area insets. Edge inset is 14px desktop, 8 to 12px mobile.

- **Top plank:** centred, width min(1040px, 100% - 20px), holds turn crest and name, phase steps, resource plaques, round stone buttons.
- **Player ledger:** right column 226px wide at top 98px on desktop; moves to bottom-right above the phase button under 1100px; becomes a centred horizontal strip of compact crests under 760px.
- **Ability tray:** bottom-left row of 104px cards (68px on mobile).
- **Phase button:** bottom-right, thumb reach, min 200px wide and 64px tall; on mobile it takes the space beside the tray at 92px tall.
- **Hint bar:** bottom-centre, max 560px; lifts above the tray on narrow screens.
- **Panels:** centred on a sea-blue scrim (rgba(8, 26, 44, 0.55 to 0.6)); default 460px, narrow 440px, wide 1080px with a three-column faction grid that collapses to one column under 760px.

Breakpoints are 1100px, 900px and 760px, plus a hover:none rule that disables tile hover lift. Spacing runs 4, 6, 8, 10, 12, 14, 18, 22, 24px; tight 4 to 8px gaps inside controls, 10 to 14px between HUD objects, 22 to 24px panel padding.

## Elevation & Depth

Depth is physical. A raised object is a slab: a top-lit gradient surface, an inset highlight along its top edge, an inset shade along its bottom, then a hard extruded underside in its own darker material tone, then a soft blue ambient shadow that sits it on the sea. Hex tiles do the same in SVG: an 11-unit side polygon in the terrain's side-to-deep gradient under the top face. Pressing an object collapses its underside (the button travels down 4px and the edge shrinks to 1px).

### Shadow Vocabulary
- **Slab edge** (`0 5px 0 <material-edge>`, 3 to 8px by size): the extruded underside of every button, card, plank, plaque, dice tray. Always the material's own dark tone (wood-edge, go-edge, stone-edge, faction dark), never black.
- **Ambient sea shadow** (`0 9px 14px rgba(8, 30, 52, 0.3)`, up to `0 20px 34px rgba(8, 30, 52, 0.45)` for the dice tray): soft blue-black spread under raised objects.
- **Top-lit bevel** (`inset 0 2px 0 rgba(255, 255, 255, 0.45), inset 0 -3px 0 rgba(0, 0, 0, 0.18)`): lip highlight and bottom shade on buttons and plaques.
- **Plank inlay** (`inset 0 0 0 3px rgba(255, 214, 160, 0.28), inset 0 0 0 6px rgba(70, 36, 12, 0.35)`): the carved double border inside a wood board, with iron rivets in the four corners.
- **Gold halo** (`0 0 0 4px var(--gold)`): ring-shaped selection glow on armed cards, winning dice, good-news toasts.
- **Ink drop on crests** (`drop-shadow(0 3px 0 rgba(43, 29, 20, 0.5))`): SVG crests and shields.

### Named Rules
**The Slab Rule.** Anything you can press has a visible underside in its own darker tone, and pressing it sinks it into that underside. Flat clickable surfaces do not exist in this world.

**The Sea Shadow Rule.** Ambient shadows are tinted toward the sea (rgba(8, 30, 52)), never neutral grey.

## Shapes

Soft, chunky and slightly hand-cut. Controls use generous radii (10 to 18px), round stone buttons are full circles, pills are 999px. Wooden boards are deliberately irregular: each plank uses a different elliptical radius set (for example `20px 12px 24px 14px / 14px 22px 12px 20px`) and a different grain offset, so no two boards look machine-cut. Borders are thick ink, 3 to 4px on major objects, 2 to 2.5px on small ones. Tiles are pointy-top hexes; badges are heraldic shields; the turn banner is a ribbon with notched tails. Region borders are dotted ink lines (dash 1 9, round caps).

## Components

### Buttons
Chunky, glossy and springy; they look pressable from across the room.
- **Shape:** gently rounded slab (14px; 18px big; 11px small), 3px ink border, min height 48px.
- **Wood (default):** vertical gradient from lightened wood-light through wood-dark, white Lilita label with small ink outline, slab edge in wood-edge.
- **Go:** same build in grass green; used for the primary commit action on a surface.
- **Ghost / stone:** desaturated grey-brown (#8b7a68 to #5e5044, edge #3b3029) for back/cancel.
- **Phase button:** the go button at 24px / 64px, pinned bottom-right; while waiting on others it turns gold (#ffcf3a to #d9901a, edge #8a5a0c) and pulses brightness.
- **Hover / Focus / Active:** hover brightens (1.08) and lifts 1px; active sinks 4px and collapses the edge; disabled goes 85% grayscale at 0.7 opacity. Focus is a 3px gold outline offset 3px.

### Round stone buttons
46px circles of speckled stone (40px in the zoom stack) holding a 26px authored icon; hover lifts and tilts -4deg, active sinks 3px.

### Segments and chips
- **Segment control:** an ink-bordered dark well (rgba ink 0.5) holding transparent Fredoka 600 buttons; the selected one becomes a gold pill with ink text and scales 1.04.
- **Chips:** small brown-stone (#5e5044) quick-pick buttons in the hint bar (+1, +5, All); selected chip turns gold and scales 1.06.

### Cards / Containers
- **Plank panel:** the carved-wood board (4px ink border, irregular radius, grain, seams, rivets, slab edge 6px plus sea shadow), dark-stained for panels and modals. Enters with a bounce from 0.92 scale.
- **Faction card:** dark wood body with a faction-gradient header strip (main to dark) under a 3px ink rule; crest 58px; ability costs in gold tags.
- **Ability card:** 104 by 112px wood card with grain, 44px icon, Lilita title and a dark cost pill; hover lifts 6px and tilts -1.5deg; armed state lifts 12px with a pulsing gold halo.
- **Player ledger row:** semi-opaque brown slab with faction crest, progress bar in faction colour with a cream target tick; the current player slides out 10px and takes a faction-coloured border.

### Inputs / Fields
- **Style:** cream fill, 3px ink border, 12px radius, inset top shade, Fredoka 600 18px in ink. Room-code input is Lilita, uppercase, tracked 0.3em, centred.
- **Range slider:** dark ink track with a gold radial-gradient thumb.
- **Focus:** the global 3px gold outline.

### Navigation
The top plank is the navigation: turn crest and name, phase steps as stone pills (inactive 0.72 opacity, done 0.45, active in the current faction's gradient, lifted 2px and scaled 1.06), resource plaques of speckled stone with tabular Lilita counts that pulse gold when spendable, and round stone buttons for sound and settings. Under 900px phase labels hide; under 760px the plank wraps with phases on their own full-width row.

### Feedback
- **Toast:** ink-backed slab (0.9) with a faction crest, Fredoka 600, bounce-in from above; warnings stain deep red, good news gets the gold halo.
- **Tooltip:** 270px dark-wood card, dashed parchment rule under the head, odds shown as a green/red underline bar.
- **Banner ribbon:** faction-gradient ribbon with notched tails, 70px crest, 36px Lilita title; swings in from the left with a bounce and rotation, exits right with an ease-in.

### Board tile (signature)
A pointy-top hex with an 11-unit side in the terrain's darker tones, a 3px ink outline, a faint white inner rim, hand-placed SVG decorations (trees, pines, mountains with snow, wheat, sheep, dunes, cacti, bones) seeded per tile, and a shield badge with the troop count. Ownership is a 7px ring in faction colour. States: hover lifts 5px; selected lifts 12px with a glowing gold ring; attack targets get a marching dashed danger ring; unreachable tiles dim with umber.

### Dice tray (signature)
A felt-green tray in an inset wood rim and ink border that slams up from below with a bounce. Dice are 54px faction-coloured rounded cubes with cream pips ringed in ink; they tumble while rolling, land with a squash, the winner lifts with a gold ring, the loser greys, shrinks, tilts and is crossed out in danger red.

### Icons
Authored inline SVG on a 32-unit box: filled cartoon shapes in palette colours with a 2.4-unit ink stroke and round joins, matching the board art. No icon font, no outline-only icons, no emoji.

## Do's and Don'ts

### Do:
- **Do** outline every drawn shape in Umber Ink (#2b1d14): 3 to 4px on major CSS objects, 2 to 2.5px on small ones, 2.4 to 5 units in SVG.
- **Do** give every pressable object a slab edge in its own darker material tone and sink it on press (translateY 4px, edge to 1px).
- **Do** stain wood dark (stained-wood tokens) wherever it carries body text.
- **Do** set display text in Lilita One, white or gold, with the stamped ink outline.
- **Do** let faction colour identify ownership: rings, crests, flags, dice, banner, active phase step.
- **Do** animate with the bounce curve (cubic-bezier(0.34, 1.56, 0.64, 1)) for arrivals and the out curve (cubic-bezier(0.16, 1, 0.3, 1)) for settles, routed through the motion speed scalar and skipped under reduced motion.
- **Do** author new icons and art as inline SVG in the same outlined, filled cartoon style.

### Don't:
- **Don't** use pure black, grey shadows or a faction colour as an outline.
- **Don't** use violet, gold-yellow #f0b928 or crimson for generic UI; they belong to the Death Cults, Evergarden and the Giants.
- **Don't** build flat, borderless, gridded strategy-app panels or a sidebar of stats; HUD pieces are physical objects floating over the board.
- **Don't** cut wooden boards with identical uniform radii; vary the elliptical radii and grain offset per board.
- **Don't** put Fredoka paragraphs on light wood or give body text the stamped outline.
- **Don't** add icon fonts, emoji or outline-only icon sets.
- **Don't** add linear-eased one-shot motion; linear timing is for looping texture only (coast dashes, marching target rings, dice tumble).
