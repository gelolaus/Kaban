# Modern web rules for Kaban

Read this before writing or changing any HTML, CSS or client-side JavaScript. It is self-contained, so you do not need any skill, plugin or network access to follow it.

**Source.** Distilled and adapted from Google Chrome's [modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (code under Apache-2.0, guides under CC-BY 4.0). Guide IDs are listed at the end. If your tool can run `npx -y modern-web-guidance@latest retrieve "<id>"`, use it for the full text of a guide. If it cannot, this document is enough.

**Why it exists.** Training data contains obsolete web patterns. Where this document and your memory disagree, this document wins.

## 0. Browser support policy

Assumption, to be confirmed by the project owner: Kaban targets current Chrome and Edge on Windows and current Chrome on Android. Firefox and Safari are best effort.

- Features that are **Baseline widely available** are used without fallbacks.
- Features that are **Baseline newly available** are allowed. Feature-detect them and degrade gracefully, or load a polyfill only when the feature is missing.
- Features with **limited availability** need a fallback or a polyfill, loaded conditionally. Never load a polyfill unconditionally.
- Known limited-availability features Kaban uses, with their handling:
  - `Temporal`: not in Safari. Import `@js-temporal/polyfill` only when `typeof Temporal === 'undefined'`.
  - `<dialog closedby>`: not in Safari. Treat as progressive enhancement; Esc and visible close buttons always work.
  - `overlay` transition property: not in Firefox or Safari. Without it, sheets and dialogs appear and disappear instantly. This is acceptable.
  - `attr()` typed values and `background-clip: border-area` (progress ring): use the fallbacks in section 6.
  - `corner-shape: squircle`: optional enhancement, never required.

## 1. CSS architecture

- Plain CSS. Do not use Tailwind (its preflight is a global `*` reset), CSS-in-JS runtimes or BEM.
- Declare layers once, in this order: `@layer reset, base, tokens, components, utilities;`. Use `:where()` inside a layer to keep specificity low.
- **No global `*` reset.** Reset specific elements instead.
- Use native CSS nesting. Use `@scope` when proximity should win over specificity.
- **Tokens, not literals.** No hex colors, no `px` font sizes and no magic paddings inside component CSS. Colors, fonts, sizes, radii and durations live in `src/ui/tokens.css` and are referenced with `var()`. Inline `style=""` is only for values computed at runtime (for example a progress width).
- Token tiers: literal (`--gray-900`), semantic (`--ink`, `--surface`), component (`--row-height`).
- Use `currentColor`, `inherit` and `em` before inventing a variable. Use logical properties (`margin-inline-start`, `padding-block`, `inset-inline-end`) except where flipping in RTL would be wrong.
- Use `:where(...)` rather than duplicating rules for fallbacks. Use `:not()` instead of undoing a rule. Use `:has()` instead of toggling classes in JS. Do not nest `:has()`.
- Sizes: `rem` for font sizes and spacing that should scale with the user's text size; `em` for contextual sizing; unitless `line-height`; `dvh` and `dvw` instead of `vh` and `vw`. Never `px` for `font-size`.
- Responsive: **components** adapt with `@container` queries (declare `container-type: inline-size` on the wrapper). Only the app shell (sidebar, bottom tab bar, inspector placement) uses viewport media queries.
- Text: `text-wrap: balance` on headings only. `text-wrap: pretty` on long prose only. Never on `*`.
- Animate `opacity` and `transform` (and individual `translate`/`scale`). Use `contain: layout style paint` for isolated widgets. Do not scatter `will-change`.
- Reduced motion: do not set `animation-duration: 0.01ms` globally. Use the `--animation-reduced` custom property pattern, or turn each animation off individually inside `@media (prefers-reduced-motion: reduce)`.
- Forced colors: do not rely on `background-image`, `box-shadow` or `border-image` to convey borders or state. Use `outline` or `border` with system colors under `@media (forced-colors: active)`.
- Do not use `content` to carry meaningful text. Keep text in the DOM.

## 2. Theming and dark mode

- `<meta name="color-scheme" content="light dark">` in `<head>`, and `:root { color-scheme: light dark; }`. Never set `color-scheme: light` or `dark` on the root by default.
- Define each semantic color once with `light-dark()` over two raw tokens:

```css
:root {
  --ink-light: #000;      --ink-dark: #fff;
  --ink: light-dark(var(--ink-light), var(--ink-dark));
  color-scheme: light dark;
}
```

- Provide the `prefers-color-scheme` fallback (set the same custom properties inside `@media (prefers-color-scheme: dark)`), because `light-dark()` is only newly available.
- Pass `light-dark()` colors around as unregistered custom properties. Do not rely on an inherited color crossing a `color-scheme` boundary.
- **Theme toggle is two-state, not three.** The two states are "Use system setting" and "Use the opposite". Choosing the opposite pins that exact scheme even if the OS setting later changes. Do not expose system / light / dark as three options.
  - Update the `<meta name="color-scheme">` content (`light dark`, `light`, `dark`) and persist the choice in `localStorage`.
  - Apply the stored choice with a small **inline classic `<script>`** (not a module, not deferred) in `<head>` to avoid a flash.
  - If JavaScript reads `matchMedia('(prefers-color-scheme: dark)')`, also listen for its `change` event.
- Use `accent-color`, `scrollbar-color` (with `scrollbar-width`) and `::selection` before re-creating native UI. Never transition `scrollbar-color`.
- Component-specific schemes (a dark sheet inside a light app) set `color-scheme` on that element and re-declare any inherited color properties.

## 3. Design tokens and verified contrast

Kaban's colors, with measured WCAG contrast. Text needs 4.5:1; large text and UI components need 3:1.

| Token | Dark | Light | Notes |
|---|---|---|---|
| `--bg` | `#000000` | `#F2F2F2` | |
| `--surface` (card) | `#131313` | `#FFFFFF` | |
| `--surface-header` | `#181818` | `#F7F7F7` | |
| `--surface-selected` | `#1E1E1E` | `#EDEDED` | |
| `--ink` | `#FFFFFF` | `#000000` | |
| `--ink-2` (secondary text) | `#8F8F8F` | `#6B6B6B` | Dark: 5.15 to 6.49:1. Light: 4.55 to 5.33:1. **Do not use `#777777`**; it is 4.00:1 on `#F2F2F2` and fails. |
| `--signal` | `#C8102E` | `#C8102E` | White text on it is 5.88:1. As text on `#000` it is 3.57:1 and on `#131313` 3.16:1, so **never use signal as small text on dark**. Use it only as a fill with white text, a 1px border, or a bar fill. |

- Status is never color alone. Overspent always shows the "▲" marker and a minus sign. Underfunded shows an outline plus a text caption. Funded shows the amount.
- Progress bar tracks are low contrast on purpose. The filled part (14:1) and the written amount carry the meaning, so the bar is never the only source of information.

## 4. Typography and fonts

- Faces: Nothing Serif (page titles, large numbers), Geist (UI and body). No monospace face.
- Money uses `font-variant-numeric: tabular-nums` so columns align.
- Self-host all fonts from `public/fonts/` as `woff2`, subset to the characters needed (Latin, digits, the peso sign `₱`, the minus sign `−`, the arrow `▲`). Use `font-display: swap`.
- Preload only the one or two fonts above the fold, always with `crossorigin`: `<link rel="preload" href="/fonts/x.woff2" as="font" type="font/woff2" crossorigin>`. Do not preload every face. Do not set `fetchpriority` on fonts.
- Define fallbacks that match metrics (`size-adjust`, `ascent-override`) so swapping fonts does not shift layout. When the Nothing Serif file is missing, fall back to Newsreader (self-hosted), then `Georgia, serif`.
- Never use `@import` in CSS.
- Never use `text-align: justify`. Keep prose to about 80 characters per line.

## 5. Semantics and accessibility

- Landmarks: `<header>`, `<nav aria-label="…">`, `<main id="content" tabindex="-1">`, `<aside>`. Provide a skip link to `#content`. Do not label a `<section>` just to make it a landmark.
- One `<h1>` per view, sequential headings, `<html lang="en">`, a unique `<title>` per view, updated when the view changes.
- **The budget grid is a real `<table>`** with `<caption>` (visually hidden is fine), `<th scope="col">` for Category, Assigned, Activity, Available, and `<th scope="row">` for category names. Do not build it from `div`s or `button`s. Make the selected row selectable with a real `<button>` inside the row header cell.
- **A button must not contain block elements** (`div`). Use `span` with `display: block` if needed.
- Prefer native elements over ARIA. Do not add redundant roles.
- Accessible names: use `<label for>`; do not rely on `placeholder` or `title`. Icon-only buttons need an `aria-label` or visually hidden text. Do not put the role name or the state in the label. Two controls with different effects must not share a name (multiple "Edit" buttons need distinguishing text).
- Do not hide focusable elements with `aria-hidden`.
- Use `disabled` rarely. Prefer leaving buttons enabled and responding on use (or `aria-disabled` so the control stays focusable).
- **Focus:** style `:focus-visible` explicitly with an `outline` and `outline-offset`. Never `outline: none` without a replacement. Never positive `tabindex`.
- **Touch targets:** at least 24×24 CSS px everywhere (WCAG 2.5.8). On `@media (pointer: coarse)`, make primary controls at least 44 px, and form inputs 48 px. Enforce with `min-block-size` and padding, not fixed `height`. Do not use `touch-action: none`; use `pan-y` for horizontal swipes.
- **Live regions:** one `polite` region and one `assertive` region for the whole app. Use polite for "Saved" and "Cover applied". Use assertive only for data-loss or sync-failure states. Do not announce "Loading".
- **Errors:** show an inline message tied to the field with `aria-describedby`, plus an icon or text (never color alone). On submit failure, move focus to the first error.
- Reduced motion, forced colors and 200% text zoom must not break layouts or hide information.
- After any view change (tab switch, sheet close, view transition), move focus to the new view's heading (`tabindex="-1"`).

## 6. Components

**Dialogs and bottom sheets.** Use the native `<dialog>` opened with `showModal()` (or `command="show-modal"` with `commandfor`). The browser makes the rest of the page inert, so do not write a focus trap. Esc closes it. Give it `aria-labelledby`. The phone inspector and add-transaction sheet are dialogs styled as bottom sheets. The command palette is a dialog.
- Invoker commands (`commandfor`, `command`) are newly available. Feature-detect with `'commandForElement' in HTMLButtonElement.prototype` and load `invokers-polyfill` only when missing. Listen for the `command` event on the target element, not on a parent.
- Animate in and out with `@starting-style`, `transition-behavior: allow-discrete` and `overlay`:

```css
dialog[open] { opacity: 1; translate: 0; @starting-style { opacity: 0; translate: 0 2rem; } }
dialog { opacity: 0; translate: 0 2rem;
  transition: opacity .18s ease-out, translate .18s ease-out, display .18s, overlay .18s;
  transition-behavior: allow-discrete; }
dialog::backdrop { transition: background-color .18s, display .18s allow-discrete, overlay .18s allow-discrete; }
```

- Add the reduced-motion version: no `translate`, shorter duration.

**Toasts.** `<div popover="manual">` in the top layer, with a close button (`popovertargetaction="hide"`), an auto-dismiss timer (`hidePopover()`), and the polite live region for the announcement. Multiple toasts must not hide each other. Load `@oddbird/popover-polyfill` conditionally (`!('popover' in HTMLElement.prototype)`) and write selectors as `[popover]:is(:popover-open, .\:popover-open)`.

**Progress.**
- Bars: native `<progress value max>` styled with CSS, or an element with `role="progressbar"` only if `<progress>` truly cannot work. The amount and caption text carry the meaning.
- Goal ring (Plan 3): use `<progress>` plus `conic-gradient`, animated through a registered `@property --value`:

```css
@property --value { syntax: '<number>'; inherits: true; initial-value: 0; }
progress.ring { --value: attr(value type(<number>)); transition: --value 0s;
  background: conic-gradient(var(--ink) calc(var(--value) * 1%), var(--track) 0);
  background-clip: border-area; border: 0.6rem solid transparent; border-radius: 50%; }
@media (prefers-reduced-motion: no-preference) { progress.ring { transition-duration: .4s; } }
```

  Fallbacks: `@supports not (background-clip: border-area)` use `mask-image: radial-gradient(...)`. If `attr()` typed values are unsupported, sync the `value` attribute to `--value` with a `MutationObserver`.
- Any chart drawn with CSS or SVG needs a visually available text or table alternative (for example the Reflect numbers as a `<table>`).

**Tables and sticky headers.** Use `position: sticky` on the column header row and (on wide screens) the row headers. Place the table in a wrapper with `container-type: inline-size`. When the container is narrow, switch the table to the stacked card layout with `@container (width < 600px)`. Inject cell labels with `content: var(--label) ": " / var(--label)` so screen readers hear the label. On the phone Plan screen the stacked layout is the default.

**Swipe gestures (phone).** Build swipe-to-assign or swipe-to-act with CSS scroll snap, not a gesture library: each row has a horizontal `overflow: scroll clip` track with `scroll-snap-type: x mandatory`, `overscroll-behavior-x: none`, spacer pseudo-elements as snap points, and `touch-action: pan-y`. The swipe is only an enhancement; the same action must be available through a visible control and the keyboard.

**View transitions.** Wrap tab and view changes in `document.startViewTransition(...)` only when it exists. Give each shared element a unique `view-transition-name` and remove temporary names afterwards. Do not transition elements that are animating. Disable under `prefers-reduced-motion`. Move focus after the transition finishes.

**Sidebar or inspector as a drawer (tablet).** Use a non-modal `<dialog>` or a popover so Esc and light dismiss work, and give it a heading and close button.

## 7. Forms and money input

- Wrap controls in `<form>`; use `<button type="submit">` with an action label ("Save transaction"); name every control; labels above inputs; `<fieldset>` and `<legend>` for groups.
- **Money fields:** `<input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done">`. Do not use `type="number"` (spinner and scroll bugs, locale issues). Parse the entered text to **integer centavos with string logic**, never `parseFloat` math. Format with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })` for display, and render the minus as "−" (U+2212) with `formatToParts` so it matches the design.
- Input `font-size` is at least `1rem` so iOS does not zoom.
- Choosing among 1 to 5 options: radios. 6 or more options: `<select>`. Long or dynamic lists (payees, categories): `<input list>` with `<datalist>`, or a combobox built on the ARIA pattern if the list must show balances.
- **Validation timing:** clear errors on `input`, validate on `blur`, block and move focus on `submit`. Style with `:user-invalid` and `:user-valid`, not `:invalid`, so required-empty fields are not flagged on load. Do not disable the submit button to block validation. Disable it only after a valid submit to stop double posting.
- Enter handling in text fields: check `KeyboardEvent.isComposing` before treating Enter as submit.
- `autocomplete` values only when they genuinely apply. Payee fields: `autocomplete="off"` with the app's own suggestions.
- Make sure the on-screen keyboard does not hide the Save button (use `scroll-padding` and keep the key actions in the upper part of the viewport).

## 8. Dates, months and numbers

- Use `Temporal.PlainDate` for transaction dates and `Temporal.PlainYearMonth` for budget months. Do not use `Date` for date logic. Never use "the 1st of the month" as a stand-in for a month.
- Create values with an explicit calendar (`calendar: 'iso8601'`) when building from objects.
- Store dates as ISO strings (`2026-10-05`, `2026-10`). Convert at the edges.
- Load the polyfill conditionally (section 0). Initialise the app after it is ready.
- Targets with "needed by the 1st" or yearly cadence use `PlainMonthDay` and convert to a `PlainDate` before arithmetic.
- All money is integer centavos. See the architecture rules in the spec.

## 9. Performance

- Interaction budget: any task over 50 ms must be sliced. Use `scheduler.yield()` with a `setTimeout` fallback. Work over about 250 ms goes to a Web Worker. Update the UI first, then do the heavy work.
- The budget engine must recompute only what changed. Heavy recomputation (for example importing thousands of transactions) runs off the main thread.
- Long lists (registers, Spending): `content-visibility: auto` with `contain-intrinsic-block-size: auto <estimate in rem or lh>` on rows or groups. Do not use it on above-the-fold content or small lists.
- Do not interleave DOM reads and writes in loops. Debounce `scroll`, `resize` and rapid `input` handlers.
- Code-split by route and heavy feature (Reflect charts, import parsers) with dynamic `import()`. Split vendors in the Vite config. No single huge bundle.
- Scripts are `type="module"` (deferred). No blocking scripts in `<head>` except the tiny theme script in section 2. No third-party scripts at all.
- Images and video: none are expected. If an image is ever added, give it `width` and `height`, lazy-load it unless it is the largest paint above the fold, and never lazy-load the LCP image.
- **Service worker and caching** (Kaban is offline-first, so this differs from the generic online-first advice):
  - Precache the app shell and all hashed assets at build time (`vite-plugin-pwa`). Serve hashed static assets cache-first.
  - Use update-on-prompt: show a "New version available" toast and let the user reload. Never silently swap code under an open session.
  - Do not cache POST requests or sync API traffic. The sync layer handles its own queue.
  - Do not send `Cache-Control: no-store` for the app shell or static assets (it disables the back-forward cache). Use `no-cache` for the HTML shell.
  - Bound cache sizes and expire old versions.
  - Ask the browser for persistent storage (`navigator.storage.persist()`) so the local database is not evicted.

## 10. Security and privacy

- Everything is served over HTTPS. Send HSTS, starting with a short `max-age` and increasing it.
- **No third-party runtime scripts, fonts or icon CDNs.** Self-host everything. No analytics, ads or trackers. Collect nothing speculatively.
- Never write untrusted strings with `innerHTML`, `outerHTML`, `document.write` or `dangerouslySetInnerHTML`. Payee names, memos and imported file contents are untrusted. Render them as text. If HTML must be inserted, use `setHTML` (Sanitizer API) or DOMPurify.
- Content Security Policy for a static SPA: hash-based `script-src` (no `unsafe-inline`), `base-uri 'none'`, `object-src 'none'`, `frame-ancestors 'self'`. Ship it as `Content-Security-Policy-Report-Only` first, then enforce. Do the same for Trusted Types (`require-trusted-types-for 'script'`) as report-only first, since framework compatibility must be checked.
- Other headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying unused features.
- **Sync credentials** (device pairing token or database token): do not store them in `localStorage` or `sessionStorage`. Keep them in IndexedDB (or an OPFS file), never in source, logs, URLs or error messages. Scrub them from any exported backup. Offer "Remove data from this device", which deletes the local database and credentials and calls `Clear-Site-Data` through a subresource request.
- Exported JSON backups stay on the user's device and never go to a server.
- Theme and density preferences are not sensitive and may use `localStorage`.

## 11. Definition of done for any UI task

- [ ] Uses tokens only; no hex, no `px` font sizes, no `*` reset, no `@import`.
- [ ] Works in light and dark and with `forced-colors`; contrast meets section 3.
- [ ] Keyboard-only walkthrough passes: every control reachable, focus visible, Esc closes sheets, focus returns to the trigger.
- [ ] Touch targets meet section 5 on `pointer: coarse`.
- [ ] Status is never color alone; every icon-only control has a name.
- [ ] Respects `prefers-reduced-motion`.
- [ ] Layout holds at 200% text zoom and at widths 360, 820 and 1440 px.
- [ ] Money entered and displayed through the shared helpers only (integer centavos).
- [ ] No untrusted string reaches an HTML sink.
- [ ] No new third-party request; fonts and icons self-hosted.
- [ ] New long lists use `content-visibility`; new routes are code-split.
- [ ] `pnpm verify` passes.

## 12. Where the design mock deviates (do not copy these)

`docs/design/kaban-mock.html` is a visual reference only. It was built quickly and intentionally breaks several rules above. Do not copy its code. Specifically it uses: `px` font sizes, inline styles with literal values, a global `*` reset, `innerHTML` templates, `div`s inside `button`s, a non-semantic div-based grid instead of a `<table>`, third-party CDN fonts and icons, a hard-coded `#777` secondary color in the light theme (fails contrast), and a three-state theme control. Match its look and structure, not its implementation.

## 13. Guide IDs (for optional retrieval)

`css`, `css-layout`, `design-token-reactivity`, `fluid-scaling`, `size-aware-styling`, `style-parent-with-has`, `child-state-based-styling`, `reduce-style-repetition`, `individual-transform-properties`, `dark-mode`, `contrast-color`, `improve-text-layout-and-legibility`, `visually-stable-font-fallbacks`, `visually-stable-mixed-fonts`, `customize-scrollbar-color-and-thickness`, `same-document-transitions`, `animate-element-entry-exit`, `animate-to-from-top-layer`, `declarative-dialog-popover-control`, `light-dismiss-a-dialog`, `platform-controls-dismiss-dialog`, `swipe-to-remove`, `physics-based-easing`, `persistent-top-layer-ui`, `directional-navigation-transitions`, `navigation-drawer`, `persistent-toast-notifications`, `progress-ring`, `stack-drill-down`, `component-specific-light-dark-theme`, `responsive-table`, `state-aware-sticky-headers`, `shrinking-header-on-scroll`, `forms`, `validate-input-after-interaction`, `required-field-feedback`, `ime-safe-enter-submit`, `form-fields-automatically-fit-contents`, `accessibility`, `accessible-error-announcement`, `model-partial-time-concepts`, `stabilize-reactive-state`, `support-global-calendar-systems`, `performance`, `break-up-long-tasks`, `schedule-tasks-by-priority`, `identify-inp-causes`, `interactions-in-complex-layouts`, `defer-rendering-heavy-content`, `efficient-background-processing`, `migrate-web-app-origin`, `security`, `sanitize-untrusted-html`, `trusted-types`, `privacy`.

Run `npx -y modern-web-guidance@latest search "<what you want to build>"` for anything not covered here.
