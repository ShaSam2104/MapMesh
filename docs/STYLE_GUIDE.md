# Style Guide — Cartographer's Workbench

Dark-first instrument UI. Mesh colors are brand-sacred; UI lives on a narrow grayscale axis with a single cyan accent that matches the GPX path color so it reads as signal.

## Palettes

### Dark (Midnight Studio) — default

```
--bg-0 #0B0C0E     app background
--bg-1 #14161A     elevated surfaces
--bg-2 #1A1B1E     = mesh Base color

--line #24272C     hairline border
--line-hot #2F343A active border

--ink-0 #ECEEF1    primary text
--ink-1 #9AA0A6    secondary text
--ink-2 #5A5F66    tertiary text

--accent #00E5FF   = mesh Path color
--accent-dim #00B8CC

--warn #F0B429
--danger #E05252
```

### Light (Architect's Paper)

Warm off-white, not clinical.

```
--bg-0 #F7F5F1
--bg-1 #FFFFFF
--bg-2 #EFEBE3
--line #D9D3C7
--ink-0 #17181A
--ink-1 #5A5F66
--accent #0097A7
```

## Mesh materials (8 layers)

| Layer | Default (dark) | Default (light) | Material | Notes |
|---|---|---|---|---|
| Base | `#1A1B1E` | `#EFEBE3` | Standard, roughness 0.7 | The plinth body |
| Buildings | `#3D4043` | `#C9CDD3` | Standard, roughness 0.85 | User-locked dark |
| Roads | `#121212` | `#2A2A2A` | Standard, roughness 0.95 | User-locked dark |
| Water | `#1A3D52` | `#AACFDB` | Standard, roughness 0.4, metalness 0.1 | Recessed 0.6 mm |
| Grass | `#2C3E2F` | `#C5D4B3` | Standard, roughness 0.92 | Flush |
| Sand | `#5C4F3A` | `#E8D5A8` | Standard, roughness 0.88 | Flush |
| Piers | `#4A4238` | `#B8A788` | Standard, roughness 0.8 | Raised 0.8 mm above water |
| GPX Path | `#00E5FF` | `#0097A7` | Standard, emissive = color, emissiveIntensity 1.5 | Tube, not slab |

Mesh colors are **brand-sacred** — curated material chips, not arbitrary. Every picker popover shows the default hex beside a reset ghost button.

## Typography

- **Fraunces** — display only (wordmark + empty-state hero). Tracking `-0.02em`.
- **Geist Sans** — body, UI, controls.
- **JetBrains Mono** — numerics, coordinates, dimensions, stats. `tabular-nums` + `font-feature-settings: "tnum"`.
- Uppercase section labels use `tracking-[0.14em]` (`tracking-label` in Tailwind config).
- Type scale: `11 / 13 / 14 / 16 / 22 / 40`.

## Shape and depth

- `rounded-sm` (2 px) on surfaces. `rounded-full` only for toggles + color swatches.
- 1 px hairline borders. Depth via background value steps, **never drop shadows**.
- **Only one solid-cyan button on screen at a time.**
- 2% opacity SVG topographic contour pattern as the app background texture.

## Motion

- Drawer opens: 220 ms, `ease: [0.22, 1, 0.36, 1]`.
- Generate-reveal: terrain rises over 600 ms, buildings stagger-extrude 20 ms apart.
- GPX path: draw-on stroke animation 1.2 s.
- Respect `prefers-reduced-motion: reduce`.

## Accessibility

- All interactive elements have accessible names.
- Focus rings: 2 px `var(--accent)` outline, 2 px offset.
- Contrast ratios ≥ AA in both palettes.
- Lighthouse a11y target: 95+.
