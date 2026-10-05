# Plan 0: Storage and Sync Spike Implementation Plan

> **For Grok in Cursor:** Work through the tasks in order. Do not edit this plan file: keep your progress in the chat (tick steps there). Read the spec, `docs/guidance/modern-web.md` and `docs/guidance/commit-style.md` before starting. Do not run `git add`, `git commit` or `git push`. At every "Commit checkpoint", print the file list and a commit message that you write yourself from the actual diff (follow `docs/guidance/commit-style.md`; the plan's message is only a starting point), then stop and wait for the owner to commit. If a step's expected output does not match, stop and report the actual output instead of guessing.

**Goal:** Prove or disprove that Turso's browser sync package (`@tursodatabase/sync-wasm`) can be Kaban's local database and sync engine, on the owner's laptop and phone, and record the decision.

**Architecture:** A throwaway, self-contained Vite app in `spikes/storage-sync/` exposes a small `window.spike` API over a Turso database stored in OPFS. Playwright tests drive it in Chromium (single device, two simulated devices, offline, service worker). A manual checklist covers the real phone. The only lasting output is `docs/decisions/0001-storage-and-sync.md`.

**Tech Stack:** Vite 8.3.2, TypeScript 6.0.3, `@tursodatabase/sync-wasm` 0.8.1, `ulid` 3.0.2, `vite-plugin-pwa` 2.0.0, Playwright 1.63.0, wrangler 4.147.0 (deploy), pnpm 12.9.1, Node 24.

**Spec:** `docs/superpowers/specs/2026-10-05-kaban-design.md` (sections 2, 3, 8 and 9). Rules: `docs/guidance/modern-web.md`.

## Global Constraints

- Plan 0 spike pass criteria (verbatim from the spec), all on the owner's laptop and phone:
  1. Turso's browser sync package opens a database persisted in OPFS.
  2. A write made offline in the browser survives a reload and a killed tab.
  3. Push and pull works between a laptop browser and the installed phone PWA.
  4. Two offline edits to different ledger entries both survive after both devices sync.
  5. It works with Vite and a service worker, and any required HTTP headers are known.
  6. Storage persistence on the phone is confirmed (including `navigator.storage.persist()`).
- If any criterion fails: stop, record the failure, and tell the owner. A follow-up plan will repeat the spike with Evolu. Do not write Evolu code in this plan.
- Browser target: current Chromium (Chrome and Edge on Windows, Chrome on Android).
- Sync credentials (database URL and auth token) are typed or pasted into the pairing form at runtime. They never go in source files, `VITE_*` variables, URLs, logs, or the deployed bundle. Tests read them from `SPIKE_TURSO_URL` and `SPIKE_TURSO_TOKEN` environment variables.
- No real budget data is used. The Turso database is a dedicated test database that is deleted at the end.
- Self-host everything. No CDN scripts, fonts or icons.
- Pin the exact versions above. Do not use `^` or `latest`.
- pnpm 12 refuses to run dependency build scripts unless they are approved. The only approved packages are `esbuild` and `workerd`, approved with `pnpm approve-builds esbuild workerd` (never `--all`). Any other package that asks for approval: stop and ask the owner.
- Commit messages follow Conventional Commits: `type(scope): lowercase imperative subject` and terse `- add ...` bullets. Scope for this plan: `spike`, or `docs` for the decision record.

## Review Focus

Failure modes the spec implies but the criteria do not exercise, most likely first. Each has a test below.

1. Two tabs of the app open at the same time. OPFS file handles are exclusive, so the second tab must fail with a clear error or share safely, and it must never corrupt data (Task 4, test T7).
2. A push attempted while offline must reject, keep every local row, and succeed later (Task 4, test T8).
3. A wrong or expired token must produce a recognizable auth error while local data stays readable and writable (Task 4, test T9).
4. A second device's first connection to a remote that already has tables and rows must bootstrap them without duplicating or losing rows (Task 3, test T3).
5. Storage persistence refused or unsupported must be reported, not crash the app (Task 1, test T0).

## File structure

All files are under `spikes/storage-sync/` unless noted.

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.gitignore` | Tooling |
| `index.html` | Minimal UI: pairing form and buttons that call `window.spike` |
| `src/spike-api.ts` | The `SpikeApi` and row types (the contract the tests use) |
| `src/probe.ts` | `probeEnvironment()`: secure context, isolation, OPFS, persistence, quota |
| `src/db.ts` | Turso database wrapper: open, ledger and note operations, push, pull, stats |
| `src/main.ts` | Wires the UI and installs `window.spike` |
| `tests/*.spec.ts` | Playwright tests T0 to T9 |
| `public/_headers` | Cloudflare headers file for the deployed spike |
| `docs/decisions/0001-storage-and-sync.md` (repo root) | The decision record |

## Human prerequisites (the owner does these before Task 3)

- [ ] **Step H1: Install pnpm.** Run `npm install --global pnpm@12.9.1`, then `pnpm -v`. Expected: `12.9.1`.
- [ ] **Step H2: Create a Turso test database in the web dashboard** (the Turso CLI needs WSL on Windows, so use the dashboard at turso.tech). Create a database named `kaban-spike`. Copy its URL (it starts with `libsql://`). Create a database auth token with read and write access and copy it. Keep both out of the repo.
- [ ] **Step H3: Create a Cloudflare account** (free) if there is none. Install nothing yet; Task 5 uses `wrangler` through `pnpm`.

---

### Task 1: Scaffold and environment probe

**Files:**
- Create: `spikes/storage-sync/package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.gitignore`, `index.html`
- Create: `spikes/storage-sync/src/spike-api.ts`, `src/probe.ts`, `src/main.ts`
- Test: `spikes/storage-sync/tests/probe.spec.ts`

**Interfaces:**
- Produces (`src/spike-api.ts`):
  ```ts
  export interface EnvReport { secureContext: boolean; crossOriginIsolated: boolean; opfs: boolean; persisted: boolean | null; persistSupported: boolean; quotaBytes: number | null; usageBytes: number | null; userAgent: string }
  export interface LedgerRow { id: string; device: string; category: string; delta: number; created_at: string }
  export interface OpenOptions { device: string; url?: string; authToken?: string; ensureSchema?: boolean }
  export interface SpikeApi {
    probe(): Promise<EnvReport>
    open(opts: OpenOptions): Promise<void>
    tableNames(): Promise<string[]>
    addLedger(category: string, delta: number): Promise<string>
    listLedger(): Promise<LedgerRow[]>
    setNote(id: string, value: string): Promise<void>
    getNote(id: string): Promise<string | null>
    push(): Promise<void>
    pull(): Promise<boolean>
    stats(): Promise<Record<string, unknown>>
    persist(): Promise<boolean>
    close(): Promise<void>
  }
  declare global { interface Window { spike: SpikeApi } }
  ```
  (`open`, `addLedger` and the rest are implemented in Tasks 2 and 3. In this task `main.ts` installs only `probe` and `persist`; the other members are stubs that throw `Error('not implemented')` so the file type-checks.)
- Produces: `probeEnvironment(): Promise<EnvReport>` and `requestPersistence(): Promise<boolean>` in `src/probe.ts`.

- [x] **Step 1: Scaffold the package.** Create the files with exactly these pinned dependencies. `dependencies`: `@tursodatabase/sync-wasm` 0.8.1, `ulid` 3.0.2. `devDependencies`: `vite` 8.3.2, `typescript` 6.0.3, `@types/node` 24.12.2, `@playwright/test` 1.63.0, `vite-plugin-pwa` 2.0.0, `workbox-build` 7.4.1, `wrangler` 4.147.0. Scripts: `dev` (`vite`), `build` (`tsc --noEmit && vite build`), `preview` (`vite preview`), `test` (`playwright test`). `tsconfig.json`: strict, `noUncheckedIndexedAccess`, `target ES2023`, `module ESNext`, `moduleResolution bundler`, `lib ["ES2023","DOM","DOM.Iterable"]`, `types ["vite/client"]`, `noEmit`. `vite.config.ts`: `server` and `preview` on port 5199 with `strictPort`; `optimizeDeps.exclude: ['@tursodatabase/sync-wasm']`; `worker.format: 'es'`; when `process.env.SPIKE_ISOLATE === '1'` add the headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to both `server.headers` and `preview.headers`. `.gitignore`: `node_modules`, `dist`, `test-results`, `playwright-report`, `.env*`.
- [x] **Step 2: Install.** Run `pnpm install` in `spikes/storage-sync/`. pnpm 12 blocks dependency build scripts, so it is expected to stop with `ERR_PNPM_IGNORED_BUILDS` naming `esbuild` and `workerd`. Approve exactly those two with `pnpm approve-builds esbuild workerd` (this creates `pnpm-workspace.yaml` containing `allowBuilds` entries for both), then run `pnpm install` again. Expected: exit code 0. Do not use `--all` and do not approve any other package; if a different package is named, stop and ask the owner. Then run `pnpm exec playwright install chromium`. Expected: finishes without errors.
- [x] **Step 3: Write the failing test** `tests/probe.spec.ts`:
  ```ts
  import { test, expect } from '@playwright/test'
  import type { EnvReport } from '../src/spike-api'
  test('T0: probe reports a secure OPFS context and handles persistence', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(() => 'spike' in window)
    const env: EnvReport = await page.evaluate(() => window.spike.probe())
    expect(env.secureContext).toBe(true)
    expect(env.opfs).toBe(true)
    expect(typeof env.persistSupported).toBe('boolean')
    const granted = await page.evaluate(() => window.spike.persist())
    expect(typeof granted).toBe('boolean')
  })
  ```
- [x] **Step 4: Run it to see it fail.** Run `pnpm test probe.spec.ts` (configure `playwright.config.ts` with `testDir: 'tests'`, `use.baseURL: 'http://localhost:5199'`, and `webServer: { command: 'pnpm dev', url: 'http://localhost:5199', reuseExistingServer: true }`). Expected: FAIL because `window.spike` is never defined (timeout in `waitForFunction`).
- [x] **Step 5: Implement** `probeEnvironment()` and `requestPersistence()` in `src/probe.ts` using `window.isSecureContext`, `crossOriginIsolated`, `'getDirectory' in navigator.storage`, `navigator.storage.persisted()`, `navigator.storage.persist()` and `navigator.storage.estimate()`. Each call is wrapped so an unsupported or throwing API yields `null` or `false` instead of an exception. Implement `src/main.ts` to install `window.spike` with `probe` and `persist` and the stubs.
- [x] **Step 6: Run the test.** Run `pnpm test probe.spec.ts`. Expected: PASS (1 passed).
- [x] **Step 7: Commit checkpoint.** Files: everything under `spikes/storage-sync/` except `node_modules`, including `pnpm-lock.yaml` and `pnpm-workspace.yaml`. Message:
  ```
  feat(spike): scaffold storage and sync spike with environment probe

  - add a self-contained Vite app in `spikes/storage-sync` with pinned dependencies
  - add `probeEnvironment` and `requestPersistence` for OPFS and persistence checks
  - cover the probe with a Playwright test
  ```

### Task 2: Local database in OPFS (criteria 1 and 2)

**Files:**
- Create: `spikes/storage-sync/src/db.ts`
- Modify: `spikes/storage-sync/src/main.ts`, `spikes/storage-sync/index.html`
- Test: `spikes/storage-sync/tests/local.spec.ts`

**Interfaces:**
- Consumes: `SpikeApi`, `OpenOptions`, `LedgerRow` from Task 1.
- Produces (`src/db.ts`): `openDb(opts: OpenOptions): Promise<SpikeDb>` where `SpikeDb` has `tableNames(): Promise<string[]>`, `addLedger(category: string, delta: number): Promise<string>`, `listLedger(): Promise<LedgerRow[]>`, `setNote(id: string, value: string): Promise<void>`, `getNote(id: string): Promise<string | null>`, `push(): Promise<void>`, `pull(): Promise<boolean>`, `stats(): Promise<Record<string, unknown>>`, `close(): Promise<void>`.
- Schema (run when `ensureSchema !== false`): `CREATE TABLE IF NOT EXISTS ledger (id TEXT PRIMARY KEY, device TEXT NOT NULL, category TEXT NOT NULL, delta INTEGER NOT NULL, created_at TEXT NOT NULL)` and `CREATE TABLE IF NOT EXISTS note (id TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`.

- [x] **Step 1: Write the failing tests** `tests/local.spec.ts`. Use a helper `boot(page)` that goes to `/` and waits for `window.spike`. Tests, all with no remote configured:
  - **T1** `entries survive a reload`: `open({device:'A'})`, `addLedger('food', -120000)` returns a non-empty id, reload, `open({device:'A'})` again, `listLedger()` has exactly one row with `delta === -120000` and `device === 'A'`.
  - **T2** `entries survive closing the page right after a write`: in one page `open`, then `addLedger('rent', -500000)` and immediately `page.close()` without awaiting anything else; open a new page in the same context, `open`, and expect the row to be present. Repeat the write-then-close 3 times in a loop with different categories and expect all 3 rows at the end.
  - **T2b** `notes round-trip`: `setNote('n1','x')`, `getNote('n1')` is `'x'`; `getNote('missing')` is `null`.
  - **T2c** `ids are unique ULIDs`: add 50 entries quickly; ids are 50 distinct 26-character strings.
- [x] **Step 2: Run them to see them fail.** Run `pnpm test local.spec.ts`. Expected: FAIL (`open` throws `not implemented`).
- [x] **Step 3: Implement `openDb`** in `src/db.ts` with `connect` from `@tursodatabase/sync-wasm`, path `kaban-spike.db`, `clientName` set to the device name, and no `url` (local-only). Use `ulid()` for ids. All SQL goes through `prepare(...).run/all/get` with positional placeholders. `listLedger` orders by `id`. Wire the methods into `window.spike` in `src/main.ts`; `open` stores the instance so later calls use it. In `index.html` add a `<pre id="out">` and exactly these buttons, each printing its result as JSON into `#out`: **Probe**, **Persist**, **Open local**, **Add ledger row**, **List rows**, **Push**, **Pull**, **Stats**. Task 3 adds **Pair**. The phone checklist in Task 6 uses these names.
- [x] **Step 4: If `pnpm dev` fails to load the WASM or a worker** (console error naming a worker or `.wasm` import), switch the import in `src/db.ts` to `@tursodatabase/sync-wasm/vite` for development only (the package exports this subpath for Vite dev). Note which import worked; it goes in the decision record.
- [x] **Step 5: Run the tests.** Run `pnpm test local.spec.ts`. Expected: PASS (4 passed).
- [x] **Step 6: Record numbers** by running `spike.stats()` in the browser console after 50 writes and noting `mainWalSize` and the OPFS usage from `probe()`. Keep the values for the decision record.
- [ ] **Step 7: Commit checkpoint.** Files: `src/db.ts`, `src/main.ts`, `index.html`, `tests/local.spec.ts`. Message:
  ```
  feat(spike): add local Turso database in OPFS with persistence tests

  - add `openDb` with ledger and note tables and ULID ids
  - expose the database through `window.spike`
  - cover reload, killed page, notes, and id uniqueness with Playwright (criteria 1 and 2)
  ```

### Task 3: Sync between two simulated devices (criteria 3 and 4)

**Files:**
- Modify: `spikes/storage-sync/src/db.ts`, `spikes/storage-sync/src/main.ts`, `spikes/storage-sync/index.html`
- Test: `spikes/storage-sync/tests/sync.spec.ts`

**Interfaces:**
- Consumes: `openDb` from Task 2.
- Produces: `openDb` now honors `OpenOptions.url` and `authToken` (passed to `connect`) and `ensureSchema`. `push`, `pull` and `stats` call the database's `push()`, `pull()` and `stats()`.

- [ ] **Step 1: Write the failing tests** `tests/sync.spec.ts`. Read `SPIKE_TURSO_URL` and `SPIKE_TURSO_TOKEN`; if either is missing, `test.skip` the whole file with the message `needs SPIKE_TURSO_URL and SPIKE_TURSO_TOKEN`. Create two browser contexts, `A` and `B`, each with its own page, as two devices. Before each test, clear the remote by opening a third context, running `open({device:'reset', url, authToken})`, `DELETE FROM ledger`, `DELETE FROM note` through a helper `window.spike.resetRemote()` (add `resetRemote(): Promise<void>` to `SpikeApi` and `main.ts`; it runs the two deletes then `push()`). Tests:
  - **T3** `second device bootstraps existing tables and rows`: A opens with the remote, adds 2 ledger rows, pushes. B opens with the remote and `ensureSchema: false`, then `tableNames()` includes `ledger` and `note`, and `listLedger()` returns exactly A's 2 rows (no duplicates).
  - **T4** `two offline edits to different rows both survive`: A and B both open and sync once. Set both contexts offline with `context.setOffline(true)`. A adds ledger `'a'`, B adds ledger `'b'`. Go online. A pushes, then B pushes, then A pulls, then B pulls. Both devices list both rows (`'a'` and `'b'`, 2 rows each, no duplicates).
  - **T5** `last push wins for the same row`: both devices sync once with `setNote('n1','start')` pushed by A and pulled by B. Offline, A sets `n1` to `'from-A'`, B sets `n1` to `'from-B'`. Online: A pushes, then B pushes, then both pull. Both devices read `getNote('n1')` as `'from-B'`. If the actual value differs, the test fails; copy the actual behavior into the decision record.
  - **T6** `a write made offline survives a reload while still offline`: one device, offline, adds a row, reloads the page (still offline), reopens with the remote config, and the row is present.
- [ ] **Step 2: Run them (without credentials) to confirm they skip,** then with credentials to see them fail. Run `pnpm test sync.spec.ts`. Expected without env: `4 skipped`. Then set the two variables in the shell (not in a file in the repo) and run again. Expected: FAIL (remote options are ignored).
- [ ] **Step 3: Implement remote support** in `src/db.ts`: pass `url` and `authToken` to `connect` when present. `resetRemote` is a helper in `main.ts`, not in `SpikeDb`.
- [ ] **Step 4: Add a pairing form** to `index.html`: two fields (database URL, token) and a Pair button. On pairing, store both in IndexedDB (database `spike-credentials`, object store `kv`, keys `url` and `authToken`), never in `localStorage`. On page load, read them back. Tests keep using `open({url, authToken})` directly.
- [ ] **Step 5: Run the tests with credentials.** Expected: PASS (4 passed). If T3 shows duplicated rows or a missing table, or T4 loses a row, stop and report; that fails criterion 4.
- [ ] **Step 6: Commit checkpoint.** Files: `src/db.ts`, `src/main.ts`, `src/spike-api.ts`, `index.html`, `tests/sync.spec.ts`. Message:
  ```
  feat(spike): add Turso sync with two-device offline tests

  - pass the remote URL and token to `connect` and add a pairing form backed by IndexedDB
  - cover bootstrap, two offline edits, last-push-wins, and offline reload with Playwright
  - skip the sync tests when `SPIKE_TURSO_URL` and `SPIKE_TURSO_TOKEN` are not set
  ```

### Task 4: Failure behavior (Review Focus 1 to 3)

**Files:**
- Modify: `spikes/storage-sync/src/db.ts`, `spikes/storage-sync/src/main.ts`
- Test: `spikes/storage-sync/tests/failure.spec.ts`

**Interfaces:**
- Consumes: `SpikeApi` from Tasks 1 to 3.
- Produces: `open`, `push` and `pull` reject with an `Error` whose `message` is preserved; the tests assert on rejection, not on message text, and print the message for the decision record.

- [ ] **Step 1: Write the tests** `tests/failure.spec.ts`:
  - **T7** `a second tab does not corrupt the first` (no remote needed): in one context open page 1, `open({device:'A'})`, add a row. Open page 2 in the same context, call `open({device:'A'})` and record whether it resolves or rejects (`test.info().annotations.push({type:'tab2', description: ...})`). Then on page 1 `listLedger()` still returns the row, and a new `addLedger` still works. After closing page 2, page 1 `listLedger()` is consistent.
  - **T8** `push while offline rejects and keeps data` (needs credentials): open with the remote, add a row, `context.setOffline(true)`, `push()` rejects, `listLedger()` still has the row, go online, `push()` resolves, and a second device pulls the row.
  - **T9** `a wrong token gives an error and keeps local data` (needs credentials): open with the real URL and `authToken: 'invalid-token'`, `pull()` rejects, `addLedger` and `listLedger` still work locally.
- [ ] **Step 2: Run them.** Run `pnpm test failure.spec.ts`. Expected: T7 passes or fails honestly; T8 and T9 skip without credentials and pass with them. Any test that fails because data is lost or corrupted is a spike failure: stop and report.
- [ ] **Step 3: Adjust `src/db.ts`** only if a test shows an unhandled error escaping as a hang or crash (for example wrap `open` so a rejected second open leaves the first connection untouched). Keep fixes minimal; this is a spike.
- [ ] **Step 4: Note the observed behavior** of T7 (second tab fails with error text, or works) and the error messages from T8 and T9 for the decision record.
- [ ] **Step 5: Commit checkpoint.** Files: `tests/failure.spec.ts` and any `src` changes. Message:
  ```
  test(spike): cover second tab, offline push, and invalid token behavior

  - assert a second tab never corrupts the first tab's data
  - assert an offline push rejects without losing rows and succeeds later
  - assert an invalid token errors while local reads and writes keep working
  ```

### Task 5: Service worker, headers, and deployment (criterion 5)

**Files:**
- Modify: `spikes/storage-sync/vite.config.ts`, `spikes/storage-sync/playwright.config.ts`
- Create: `spikes/storage-sync/public/_headers`, `spikes/storage-sync/public/icon.svg`
- Test: `spikes/storage-sync/tests/pwa.spec.ts`

**Interfaces:**
- Consumes: the built app from Tasks 1 to 4.
- Produces: a deployable `dist/` that works offline.

- [ ] **Step 1: Add the PWA plugin** to `vite.config.ts` using `VitePWA` with `registerType: 'autoUpdate'`, a manifest (`name: 'Kaban spike'`, `short_name: 'Spike'`, `display: 'standalone'`, `start_url: '/'`, `theme_color` and `background_color` `#000000`, one `icon.svg` icon with `sizes: 'any'`), and `workbox.globPatterns: ['**/*.{js,css,html,wasm,svg}']` with `maximumFileSizeToCacheInBytes: 20971520` so the WASM file is precached. Add a second Playwright project `preview` on port 5198 whose `webServer` is `pnpm build && pnpm preview --port 5198`.
- [ ] **Step 2: Write the failing test** `tests/pwa.spec.ts` (project `preview`):
  - **T10** `the built app works offline`: load `/`, wait for the service worker to be active (`navigator.serviceWorker.ready`), `open({device:'A'})`, add a row, `context.setOffline(true)`, reload, `window.spike` still exists, `open` works, and the row is listed.
  - **T11** `the wasm file is precached`: after the service worker is active, `caches.keys()` then `cache.keys()` includes a request whose URL ends with `.wasm`.
- [ ] **Step 3: Run it.** Run `pnpm test --project=preview pwa.spec.ts`. Expected: FAIL at first if the WASM file is missing from the precache or the worker fails; fix `globPatterns` until it passes.
- [ ] **Step 4: Find out whether cross-origin isolation headers are needed.** Run the whole suite twice: `pnpm test` and `SPIKE_ISOLATE=1 pnpm test`. If everything passes without isolation, record "no COOP/COEP needed". If the first run fails with an error mentioning `SharedArrayBuffer`, record "COOP and COEP required", and add them to `public/_headers`:
  ```
  /*
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp
  ```
  (Plan 1's security headers must then include them.)
- [ ] **Step 5: Human step H4: deploy.** Run `pnpm exec wrangler login`, then `pnpm exec wrangler pages project create kaban-spike --production-branch main`, then `pnpm build` and `pnpm exec wrangler pages deploy dist --project-name kaban-spike`. Expected: a URL ending in `.pages.dev`. Open it on the laptop and confirm `window.spike.probe()` shows `secureContext: true`.
- [ ] **Step 6: Commit checkpoint.** Files: `vite.config.ts`, `playwright.config.ts`, `public/_headers`, `public/icon.svg`, `tests/pwa.spec.ts`. Message:
  ```
  feat(spike): add service worker precache and offline reload tests

  - add `vite-plugin-pwa` with the WASM file precached
  - cover offline reload and the cached WASM with a preview-build Playwright test
  - document whether cross-origin isolation headers are required
  ```

### Task 6: Phone verification (criteria 3 and 6) and the decision record

**Files:**
- Create: `docs/decisions/0001-storage-and-sync.md`
- Modify: `spikes/storage-sync/index.html` (add a visible `Probe` button and results area if not present)

**Interfaces:**
- Consumes: the deployed spike URL from Task 5.
- Produces: the decision record that Plan 1 and later plans read.

- [ ] **Step 1: Phone checklist (the owner does this on the Nothing phone in Chrome).** Tick each result and write down what happened:
  1. Open the `.pages.dev` URL. Tap **Probe**. Record `secureContext`, `opfs`, `persisted`, `quotaBytes`.
  2. Tap **Install** from Chrome's menu ("Install app" or "Add to Home screen"). Open it from the home screen.
  3. Paste the database URL and token into the pairing form and tap **Pair**. Tap **Persist**. Record whether it returns `true`.
  4. On the laptop (deployed URL, paired the same way) add 2 ledger rows and tap **Push**. On the phone tap **Pull**. Expect those 2 rows. (criterion 3)
  5. Put the phone in airplane mode. Add 2 ledger rows. Close the app completely (swipe it away) and reopen it. Expect the 2 rows still listed. (criteria 2 and 6)
  6. On the laptop, turn off Wi-Fi, add 1 row, reconnect later. Turn the phone's airplane mode off. Push from phone, push from laptop, pull on both. Expect all 5 rows on both. (criterion 4 on real devices)
  7. Leave the installed app unused for a day and open it again. Expect the data still there.
- [ ] **Step 2: Write the decision record** `docs/decisions/0001-storage-and-sync.md` with these sections: Context; Criteria results (a table with the six criteria, Pass or Fail, and the evidence: test names, the observed phone result); Observations (which import path worked; whether COOP and COEP are required; the T7 two-tab behavior; the T5 last-push-wins result; offline and invalid-token error messages; database size and WAL size after 50 writes; the WASM size in kilobytes from the `dist/assets` listing); Decision (Turso Sync adopted, or "failed criterion N, repeat the spike with Evolu"); Consequences for Plan 1 (headers, storage layer shape, the schema-bootstrapping rule from T3). Fill every field from real observations; do not leave any field unfilled.
- [ ] **Step 3: Clean up (human).** Revoke the Turso token and delete the `kaban-spike` database in the dashboard. Delete the Cloudflare project: `pnpm exec wrangler pages project delete kaban-spike`. Uninstall the spike PWA from the phone.
- [ ] **Step 4: Report to the owner** with the decision and the evidence table, and wait for approval before deleting `spikes/storage-sync/` in a separate later commit.
- [ ] **Step 5: Commit checkpoint.** File: `docs/decisions/0001-storage-and-sync.md`. Message:
  ```
  docs(decisions): record storage and sync spike results

  - record each of the six spike criteria with test and device evidence
  - note required headers, import path, two-tab behavior, and last-push-wins behavior
  - state the storage and sync decision and its consequences for plan 1
  ```

## Self-review notes

- Spec coverage: criteria 1 and 2 (Task 2, T1 and T2, phone step 5), criterion 3 (Task 3 T3, phone step 4), criterion 4 (T4, phone step 6), criterion 5 (Task 5, T10 and T11, header step), criterion 6 (Task 1 T0, phone steps 3, 5 and 7). Fallback ladder and "stop and report" are in Global Constraints.
- Types are defined once in `src/spike-api.ts` (Task 1) and reused unchanged. `resetRemote` is added to `SpikeApi` in Task 3.
