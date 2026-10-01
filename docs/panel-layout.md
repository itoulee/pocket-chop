# Pocket Chop — Faceplate layout & color notes

Inspired remake of SXC-1–class handheld (**~W100 × D177 × H27 mm**).  
**Product name: Pocket Chop.** No Casio logos, trademarks, SK-1 art, or official product-name branding.

Refs (study only, not shipped in UI): `docs/refs/` (AlongWalker public photos).

## Color (from public product photos)

| Zone | Official vibe | Remake tokens |
|------|---------------|---------------|
| Chassis | Soft off-white / light gray matte plastic (calculator/gamepad) | `--chassis #e8e6e0`, `--chassis-hi #f4f2ec` |
| Top cluster | Dark recessed oval bezel around OLED | `--bezel #1a1c1e`, pill/oval `.face-top-bezel` |
| D-pad / AB | Translucent lime / yellow-green | `--accent-lime #c8e850` |
| Knobs | Same pale plastic as body, ribbed rim, dark pointer notch | `.rotary-body` matte, not brushed metal |
| Transport | Small round light-gray keys | `.round-btn` |
| Pads | Black bezel + translucent row colors (green→cyan→purple→orange bottom→top) | `.pad-row-0…3` |
| Back (hw) | Yellow grip (not shown on front remake) | N/A on faceplate |
| Companion UI | Dark page chrome so pale device pops | `body` / `.app-chrome` / `.library` |

## Assumed front layout (top → bottom)

```
┌───────────────────────────────┐
│         Pocket Chop          │  remake name only
│ ╭─ black oval bezel ──────╮ │
│ │ [lime D-pad] OLED [A◆D]  │ │  + small FX1/FX2 hold
│ ╰──────────────────────────╯ │
│   ◘ FX1   INPUT/MAIN   ◘ FX2 │  two large circular knobs;
│           VOL sliders        │  short vols BETWEEN knobs
│  (▶)(■)(REC)(ONE)(LOOP)(DEL)(EDIT) │ round keys
│  [13][14][15][16]  orange    │
│  [ 9][10][11][12]  purple    │  4×4 pads dominate
│  [ 5][ 6][ 7][ 8]  cyan      │
│  [ 1][ 2][ 3][ 4]  green     │  (row glow like photos)
└───────────────────────────────┘
   companion: library / Seed / SEQ / SYS (dark, outside)
```

### Circular knobs (「那两个圈」)

Two large **matte plastic** rotaries under the OLED row (left FX1 / right FX2).  
Drag / wheel = P1; hold FX (or Alt) + wheel = P2. Not HTML range sliders.

### Notes

- Official INPUT VOL / MAIN VOL sit **between** the two knobs — remake matches that.
- INPUT SELECT (MIC/AUDIO IN/USB) kept discreet under the vol stack (web convenience).
- Yellow rear grip is hardware-only; not painted on the front remake.
