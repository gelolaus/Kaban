# Kaban agent instructions

## Project

Kaban is a personal zero-based budgeting PWA (YNAB alternative without bank linking). Local-first, PHP only, Chromium-first.

## Commands

- `pnpm dev` — Vite on port 5173
- `pnpm verify` — typecheck, lint, css lint, format check, unit tests, build
- `pnpm verify:e2e` — verify then Playwright
- `pnpm test <file>` — Vitest for one file
- `pnpm test:e2e <file> --project=dev|preview` — Playwright

## Pinned versions

| name                            | version |
| ------------------------------- | ------- |
| @axe-core/playwright            | 4.13.0  |
| @eslint/js                      | 9.39.5  |
| @fontsource-variable/geist      | 5.3.0   |
| @fontsource-variable/newsreader | 5.3.0   |
| @js-temporal/polyfill           | 0.5.1   |
| @oddbird/popover-polyfill       | 0.7.3   |
| @playwright/test                | 1.63.0  |
| @tursodatabase/sync-wasm        | 0.8.1   |
| @types/node                     | 24.12.2 |
| @types/react                    | 19.3.0  |
| @types/react-dom                | 19.3.0  |
| @vitejs/plugin-react            | 6.1.1   |
| eslint                          | 9.39.5  |
| eslint-plugin-react             | 7.37.5  |
| eslint-plugin-react-hooks       | 7.1.1   |
| globals                         | 17.13.0 |
| lucide-react                    | 1.52.0  |
| prettier                        | 3.9.9   |
| react                           | 19.3.0  |
| react-dom                       | 19.3.0  |
| react-router                    | 8.4.0   |
| sharp                           | 0.35.5  |
| stylelint                       | 17.16.0 |
| stylelint-config-standard       | 40.0.0  |
| typescript                      | 6.0.3   |
| typescript-eslint               | 8.71.0  |
| ulid                            | 3.0.2   |
| vite                            | 8.3.2   |
| vite-plugin-pwa                 | 2.0.0   |
| vitest                          | 5.0.3   |
| workbox-build                   | 7.4.1   |
| workbox-window                  | 7.4.1   |
| wrangler                        | 4.147.0 |

## Folder boundaries

- `src/engine/` — pure budget math (no React, storage, sync, DOM)
- `src/domain/` — result, money, dates
- `src/storage/` — Turso local database and repositories
- `src/state/` — hooks and view-model mapping
- `src/ui/` — design system
- `src/features/` — screens
- `src/app/` — shell, routing, PWA

## Hard rules

- Money is integer centavos via `parseMoney` / `formatMoney` only (no `parseFloat`).
- Dates use Temporal helpers; store ISO strings.
- Tokens only: no hex outside `tokens.css`, no `px` font sizes, no `outline: none`, no `@import`, no universal selector.
- No `innerHTML` or `dangerouslySetInnerHTML`.
- No third-party requests, fonts, or icon CDNs.
- Budget grid is a `<table>`; sheets use native `<dialog>`.
- Theme control is two-state.
- `engine/` never imports UI, storage, sync, or DOM.
- Do not add dependencies or approve pnpm build scripts beyond `esbuild` and `workerd` without asking.
- Turso is local-only (no remote URL, sync, or tokens). COOP/COEP required.
- Do not edit files under `docs/`.

## Commits

Conventional Commits `type(scope): lowercase imperative` with terse `- add ...` bullets. See `docs/guidance/commit-style.md`.

## Definition of done

Follow `docs/guidance/modern-web.md` section 11: tokens, light/dark, keyboard, touch targets, no color-only status, reduced motion, money helpers, no HTML sinks, no third-party requests, `pnpm verify` passes.

## Reading list

- `docs/superpowers/specs/2026-10-05-kaban-design.md`
- `docs/guidance/modern-web.md`
- `docs/guidance/commit-style.md`
- `docs/design/kaban-mock.html` (look only)
- `spikes/storage-sync/` (Turso reference)
