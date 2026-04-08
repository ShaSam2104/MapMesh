# `src/` conventions

## Import order

1. Node + 3rd party
2. `@/lib/*`
3. `@/state/*`
4. `@/hooks/*`
5. `@/components/*`
6. Relative `./`

Enforced by eye + ESLint autofix.

## TypeScript strictness

- `strict: true` is non-negotiable.
- No `any`. If a library's types are wrong, write a `d.ts` shim in `src/types.ts` or a local `.d.ts`.
- Use `import type` for type-only imports (ESLint enforces this).

## Adding a new feature

1. If it has state, add a field to the zustand store with a typed action.
2. If it touches the pipeline, add a function in `src/lib/` first with a sibling test.
3. Add a component in the correct subdirectory (`layout/`, `map/`, `scene/`, `controls/`, or `ui/`).
4. Log meaningful events at `debug` / `info`.
5. Update relevant `docs/*.md`.

## Adding a new layer

All 8 layers share the same shape. To add a 9th:

1. Add the key to `LayerKey` in `src/types.ts`.
2. Add a default color + icon in `src/lib/palette.ts`.
3. Add a tag predicate in `src/lib/data/osmQueries.ts` + `osmFeatures.ts`.
4. Add a geometry builder in `src/lib/geometry/` (probably wrapping `areaSlab` or `lineStrip`).
5. Wire it in the store's `layers` default record.
6. That's it — `LayerAccordion` auto-renders a new row.
