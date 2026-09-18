# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Phoenix — agent guide

Private personal-finance web app for a single household. Tracks net worth across
multi-currency accounts, monthly expenses, a property loan, a trading portfolio,
hypothetical funding plans, and a "handover" set of notes for next of kin.

Live at **phoenix-mgmt.web.app**. Single user (admin) plus optional read-only
viewers. Everything is client-side against Firestore; the only server-side code
is the scheduled sync worker in `functions/`.

---

## Stack

React 18 · TypeScript (strict) · Vite 5 · MUI v9 · Zustand 5 · React Router 6 ·
Firebase 10 (Firestore + Auth) · Recharts · dnd-kit · react-hook-form

```
npm run dev      # vite dev server
npm run build    # tsc && vite build  ← exactly what CI runs
```

There are **no tests and no linter**. `npm run build` is the only gate, so run it
before pushing. TypeScript strict mode catches unused variables (TS6133), which
is the most common CI break after a refactor.

**Local setup:** copy `.env.example` → `.env` and fill in the `VITE_FIREBASE_*`
values. `.env` is gitignored. Vite config is stock (`vite.config.ts` is just the
React plugin).

**`package.json` overrides `rollup` → `@rollup/wasm-node`.** Leave it alone; it
is what makes `npm ci` work on this machine.

### Deploy pipeline (`.github/workflows/deploy.yml`)

Push to `main` → `npm ci` → `npm run build` (with `VITE_FIREBASE_*` from GitHub
repo **vars**, `VITE_GROQ_API_KEY` from secrets) → `firebase-tools deploy
--project phoenix-mgmt`. Because `firebase.json` declares both `hosting` and
`firestore`, **that deploy also pushes `firestore.rules` and
`firestore.indexes.json`** — a rules edit goes live on the next push to `main`
with no separate step.

---

## Layout

```
src/
  main.tsx              ThemeProvider + createAppTheme(mode) — all MUI theme overrides
  App.tsx               RouterProvider, loads rates on login, inactivity logout
  router.tsx            route table
  types.ts              every domain interface
  services/
    firebase.ts         ALL Firestore reads/writes live here — one function per operation
    rates.ts            reads meta/rates (written by functions/); live fetch only if >24h stale
  store/                zustand stores, one per domain
  pages/                one component per route
  components/
    Layout.tsx          sidebar (desktop) + bottom nav & "More" drawer (mobile)
    ConfirmDialog.tsx   imperative `confirm({title, message})` → Promise<boolean>
    SaveSnapshotDialog.tsx  shared snapshot save flow
  lib/fmt.ts            fmtINR, fmtCurrency, fmtDiff, isoToDisplay
  lib/sync.ts           staleness rules shared by Accounts, Admin, Dashboard
functions/              Cloud Functions sync worker — see below
```

**Convention:** pages never import `firebase/firestore` directly. They go through
a store, or through a named function in `services/firebase.ts`.

---

## Sync worker (`functions/`)

The one piece of server-side code. A Cloud Function (Node 22, TypeScript,
**separate `package.json`** — run `npm ci --prefix functions` once) that pulls
external facts into Firestore so the user stops typing them in:

```
functions/src/
  index.ts        syncScheduled (every 4h, IST) + syncNow (callable, admin-only)
  registry.ts     the ordered list of checkers — add new ones here
  checker.ts      Checker / CheckResult / SyncStatus types
  apply.ts        runs each checker in isolation, writes results + meta/sync
  checkers/fx.ts  USD/INR + CAD/INR → meta/rates
  checkers/kraken.ts  TradeBalance.eb (all assets valued in USD) → usd
```

- **Adding a checker = one file in `checkers/` + one line in `registry.ts`**
  (+ `defineSecret`s listed on `checker.secrets`; index.ts binds the union to
  both functions). Checkers return `CheckResult[]` and never touch Firestore;
  `apply.ts` does all writes.
- **A secret must exist before deploy**: `npx firebase-tools functions:secrets:set NAME`
  (interactive, run locally). A push to `main` with an unset secret fails CI.
  Kraken spot: `KRAKEN_API_KEY`, `KRAKEN_API_SECRET` (read-only key).
- **Kraken CME futures (Kraken Derivatives US, e.g. `MGCV6` micro gold) has no
  API** — that balance is a manual account row. A checker for the *offshore*
  Kraken Futures platform (`futures.kraken.com`, `PF_*` perps) was written and
  reverted because the user's account is not on that platform; see commit
  `b1fc414` (`functions/src/checkers/krakenFutures.ts`) if it's ever needed.
- A `balance` result is written to every account whose `sync.provider` matches.
  **The account↔provider mapping lives in data**, set from the Accounts page
  edit dialog ("Sync source"), never hardcoded.
- `SyncProvider` in `functions/src/checker.ts` and `src/types.ts` must match.
  Values are frozen once used (they're stored on account docs).
- Status per checker goes to `meta/sync`; the Admin page renders it with a
  "Run now" button, and the Dashboard shows a warning when any synced account
  or the FX doc is older than 36h (`src/lib/sync.ts`).
- An account with `sync` set has its amount fields locked in the UI, same as
  `derived`. The worker sets `updatedAt` on every write.
- **Deploying functions needs the Blaze plan.** `firebase.json` includes the
  functions target, so the CI `firebase deploy` on push to `main` deploys them
  too (and fails outright if Blaze is off). Local test of a checker:
  `cd functions && npm run build && node -e "require('./lib/checkers/fx').fx.run().then(console.log)"`.
- The client `services/rates.ts` still has its own live FX fetch, but only as a
  fallback when `meta/rates` is >24h old.

---

## Firestore collections

| Collection | Shape | Notes |
|---|---|---|
| `accounts` | `Account` | `order` is a float — halves are used to insert between rows |
| `snapshots` | `Snapshot` | doc id = `YYYY-MM-DD`, or `YYYY-MM-DD-<base36>` for a 2nd row that day |
| `expenses` | `MonthExpenses` | doc id = `` `${currency}-${yearMonth}` `` e.g. `USD-2025-05` |
| `regent/config` | `PropertyConfig` | the property page |
| `regentEmis` | `PropertyEmi` | |
| `zerodha/config` | `ZerodhaConfig` | |
| `zerodhaEntries` | `ZerodhaEntry` | |
| `affordability` | `AffordabilityPlan` | |
| `handover` | `HandoverNote` | |
| `links` | `QuickLink` | dashboard shortcut chips |
| `sessions` | `Session` | one per browser tab; admin can revoke |
| `users/{uid}` | `{ role: 'admin' \| 'viewer' }` | |
| `meta/rates`, `meta/paymentModes`, `meta/rowOrder-{CUR}` | | singleton config docs |
| `meta/sync` | `Record<checkerId, SyncStatus>` | written by `functions/`, read by Admin |

### ⚠️ Collection names are frozen backend keys

`regent`, `regentEmis`, `subaruCar`, `zerodha` are **historical names**. The UI
says "Property" and "Portfolio"; the collections do not. Renaming a collection
string orphans live data. Same for the `derived` field values on accounts:
`'regent' | 'zerodha' | 'subaruCar'` — these match what's actually in the
database and must not be "tidied".

### Security rules (`firestore.rules`)

Any authenticated user can **read everything**; only `role: 'admin'` can write.
A new collection is therefore covered automatically by the catch-all rule — no
rules change needed when adding a feature. This is deliberate: the Handover
notes are meant to be readable by a viewer account.

### Viewer role in the UI

Rules are the real enforcement, but the UI must also hide/disable every write
control for viewers or they get a confusing permission error. The pattern:

- `useIsReadOnly()` from `store/authStore.ts` — `true` unless `role === 'admin'`.
  Every page that mutates calls it and gates its buttons, inline editors, and
  drag handles on it (see `AccountsPage`, `ExpensesPage`, `AffordabilityPage`).
- Nav items in `Layout.tsx` carry `adminOnly`; only `/admin` is `true`. The
  route itself is not guarded — the nav entry is just hidden.
- Role comes from `users/{uid}.role`, fetched once in `authStore` on sign-in.
  `Layout` shows a read-only banner when `role === 'viewer'`.

Any new mutating control must be wired through `useIsReadOnly()`.

---

## Domain rules that aren't obvious

**Derived accounts.** `dashboardStore.load()` fetches raw accounts, then patches
the ones with a `derived` field using live values computed from the Property and
Zerodha configs. These are patched **in memory only** — never written back.

**Zerodha contributes capital, not value.** `dashboardStore.ts:30` uses
`zerCfg.capital`, so net worth deliberately ignores all trading P&L even though
ZerodhaPage tracks it in detail. Known gap, see Open items.

**Snapshots are immutable history.** A V2 snapshot stores its own `accounts[]`
array of per-account INR values. Deleting an account does **not** alter past
snapshots. Snapshot `difference` is stored but **must not be trusted** — the
Snapshots table recomputes each row's diff from its neighbours at render time,
because a stored diff goes stale on overwrite, edit, or deletion of an earlier
row.

**Affordability is hypothetical.** Plans store only `{accountId, percent}`. Every
rupee figure is derived from live balances on each render. Allocating 100% of an
account does **not** change that account anywhere. Two plans may both claim the
same account — they are independent by design. The rupee field on the right of
an allocation row is a *calculator input*: typing an amount back-solves the
percentage, and the percentage is what gets stored. This was a deliberate choice
over storing amounts, because a stored amount becomes a lie when the balance
falls below it, and cannot express "drain this account".

**Dates are local, not UTC.** `snapshotStore.todayIso()` builds the date from
`getFullYear/getMonth/getDate`. Using `toISOString().slice(0,10)` here is a bug —
in IST it files anything saved before 05:30 under the previous day. Note the app
is otherwise IST-anchored (AdminPage formats with `Asia/Kolkata`), while snapshot
dates follow the *device* timezone. Unresolved, see Open items.

---

## Gotchas already paid for — don't rediscover these

**MUI v9 `slotProps`, not `PaperProps`.** `<Drawer slotProps={{ paper: { sx } }}>`.
The old prop is a type error.

**Dialog first-field label clipping.** MUI emits
`.MuiDialogTitle-root + & { padding-top: 0 }` — a **two-class** selector that an
`sx` prop (one class) cannot outrank. Combined with `overflow-y: auto` it clips
the top ~9px of a first outlined field's floating label. Fixed once globally in
`main.tsx` via `MuiDialogContent` styleOverrides. **Do not "fix" this with `sx`
on a dialog — it silently does nothing.**

**Mobile nav caps at 5.** MUI `BottomNavigation` takes 3–5 items. `Layout.tsx`
splits `primaryNavItems` (4, always visible) from `overflowNavItems` (in a "More"
bottom drawer). New sections go in the overflow list.

**Native `<input type="month">` is rejected UX.** The user explicitly dislikes it.
`BudgetView.tsx` has a custom Popover `MonthPicker` (year arrows + 3×4 month
grid) — reuse it. ExpensesPage still has three native ones; they should be
replaced.

---

## Workflow (strict — the user has repeated these)

- Work on branch **`claude/general-session-pY4ML`**.
- Push to **both**:
  ```
  git push origin claude/general-session-pY4ML
  git push origin claude/general-session-pY4ML:main
  ```
  Pushing to `main` is what deploys (GitHub Actions → Firebase Hosting).
- Commits must be authored `Claude <noreply@anthropic.com>`, else GitHub marks
  them **Unverified**. If that happens:
  ```
  git config user.email noreply@anthropic.com && git config user.name Claude
  git rebase --exec "git commit --amend --no-edit --reset-author" origin/main
  git push --force-with-lease origin claude/general-session-pY4ML:main
  ```
- **Do not open a PR** unless asked.
- After deploy, the user may need a hard refresh to clear cached assets.

---

## Backups

No in-app export (it was built, then removed as redundant). Backups run from a
**Google Apps Script** in the user's own Google account, on a daily time trigger:

- Discovers all root collections dynamically via the Firestore REST
  `:listCollectionIds` endpoint — so new collections are picked up automatically.
- Writes a timestamped JSON to Drive folder **Phoenix Backup**.
- Requires these `oauthScopes` in `appsscript.json` (Apps Script will not
  auto-detect the Firestore one): `drive`, `datastore`, `script.external_request`.

A side benefit: the daily API traffic keeps the Firebase project from ever
looking abandoned.

---

## Open items (audit, 2026-09-17)

Ordered by value. None are fixed.

**Correctness**
1. `ExpensesPage.tsx:358` — `Math.abs(n)` renders negative expenses as positive.
   The cell contradicts the total below it.
2. `ExpensesPage.tsx:270` — `parseFloat("1,00,000")` → `1`. Typing separators
   silently saves the wrong number.
3. `ExpensesPage.tsx:327,338` — rename/remove row loops sequential awaits over
   months; a mid-failure splits one row into two. Needs a batch write.
4. `BudgetView.tsx:180` — `.filter(i => i.amount > 0)` hides negative items from
   the breakdown while `totalOutflow` still counts them; the list stops
   reconciling with the tile.
5. `DashboardPage.tsx:50` — tooltip matches snapshots on `MM-DD`, so different
   years (or two rows in a day) collide and it shows the wrong one.

**Reliability**
6. **No store has any error handling.** Every `load()` sets `loading: true` and
   only clears it on success, so any Firestore failure = permanent spinner, no
   message, no retry, on every page. Same at `BudgetView.tsx:159` and
   `AdminPage.tsx:65` (`.then` with no `.catch`). Highest-value fix here.

**Logic / product**
7. Net worth excludes Zerodha P&L (see above).
8. `ExpensesPage.tsx:308` — adding a month copies last month's **amounts**, so a
   new month opens pre-filled with figures indistinguishable from real entries.
9. `ExpensesPage.tsx:293` — duplicate-name check is case-sensitive.
10. Snapshot date follows device timezone; rest of app is IST. Pin to IST?

**UI**
11. ExpensesPage still uses native month inputs (386, 388, 429).
12. `RequireAuth.tsx:10` — hardcoded Tailwind `bg-gray-950`; black flash in light mode.
13. `fmt.ts:15` — renders `₹-4,35,315`; convention is `-₹4,35,315`.
14. `ExpensesPage.tsx:437` — cancel button uses a trash icon.

**Housekeeping**
15. `fmt.ts:25` `excelDateToISO` — dead code, zero callers.
16. Unused deps: `@anthropic-ai/sdk`, `@dagrejs/dagre`, and `firebase-admin`
    (devDependency, no scripts use it). `VITE_GROQ_API_KEY` is declared in
    `.env.example`, `vite-env.d.ts`, and injected by `deploy.yml` for a Todo
    AI feature that no longer exists in the router.
17. Session docs accumulate — one per browser tab; admin can clear *revoked*
    sessions but not stale ones.
18. 1.6 MB single bundle (~450 KB gzip). Recharts/MUI would code-split cleanly.
19. Tailwind is configured and used in 4 files but the app is otherwise MUI.
    Pick one.
20. `README.md` is stale — still documents the Car section, the "refunded if
    cancelled" toggle, and three asset categories instead of four.

---

## Recent history (this session)

Mobile nav overflow fix · Save Snapshot moved Dashboard→Accounts→Snapshots
(now only on Snapshots) · Car section removed entirely (sold; `subaruCar` data
left untouched in Firestore) · Budget tab added to Expenses and made default,
with a %-of-expenses / %-of-income toggle · "Refunded if cancelled" removed from
Property · DB export added to Admin then removed in favour of the Apps Script
backup · Handover section added · Add Account dialog with position picker ·
delete-account confirmation · snapshot overwrite bugs fixed (stale diff, missing
prompt, all-zero saves, fallback FX rates, double-click) · note comparison in the
overwrite prompt · Affordability planner added.
