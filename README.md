# Phoenix

A personal finance and productivity management dashboard. Built as a private, self-hosted web app for tracking net worth, expenses, investments, and tasks — all in one place.

## Features

### Net Worth Dashboard
- Track assets across categories: **liquid**, **appreciating**, and **depreciating**
- Automatic multi-currency conversion (USD, CAD, INR) with live exchange rates
- Derived accounts (e.g. property equity, stock portfolio) computed automatically
- Quick-link chip bar for frequently visited external resources

### Snapshots
- Record daily net worth snapshots across all categories
- Visualise trends over time with a line chart
- Annotate each snapshot with free-form notes

### Expenses
- Monthly budget tracker per currency
- Configurable line items with salary and spend tracking
- Drag-and-drop row reordering

### Property Tracker
- Track property value using configurable rate parameters (base rate, floor premium, parking, etc.)
- Log EMI payments with full history
- Computed equity feeds back into the net worth dashboard automatically

### Stock Portfolio
- Track realised and unrealised P&L across equity, F&O, commodities, and mutual funds
- Historical entry log with date-series view

### Todos
- Visual dependency graph showing which tasks are blocked and which are ready
- Focus mode — mark a task as active; status and accumulated time sync across devices in real-time
- Per-task time tracking across all sessions
- AI-assisted task creation via an embedded chat that interviews you before creating tasks and linking dependencies
- Per-task comments with author and timestamp
- Archive and permanent delete

### Admin
- Session management — view all active sessions, revoke any remotely
- Quick links manager — add/edit/delete shortcut links shown on the dashboard
- Role-based access: `admin` users can write; `viewer` users are read-only

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| UI | MUI v9 (dark theme) |
| State | Zustand |
| Routing | React Router v6 |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | Groq API (Llama 3.3 70B via OpenAI-compatible endpoint) |
| Charts | Recharts |
| Graph layout | @dagrejs/dagre |
| Drag-and-drop | dnd-kit |
| Hosting | Firebase Hosting |

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with **Authentication** and **Firestore** enabled
- A Groq API key (for the AI todo assistant)

### Environment Variables

Create a `.env` file at the project root:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GROQ_API_KEY=
```

### Install and Run

```bash
npm install
npm run dev        # dev server with hot reload
npm run build      # type-check + production build
npm run preview    # preview the built /dist locally
```

### Firestore Setup

Deploy the included security rules:

```bash
firebase deploy --only firestore:rules
```

Create the first admin user manually in Firestore:

```
users/{uid}  →  { role: "admin" }
```

All other authenticated users default to `viewer` (read-only) until promoted by an admin.

## Architecture

```
src/
  pages/          # One file per route
  components/     # Shared UI components
  store/          # Zustand stores (one per domain)
  services/       # Firebase CRUD, AI chat, exchange rates
  hooks/          # useTodoFocus (cross-device focus state)
  utils/          # todoUtils.ts — shared todo dependency logic
  types.ts        # All shared TypeScript types
  router.tsx      # Route definitions
  main.tsx        # App entry point + MUI dark theme config
```

### Access Control

`RequireAuth` wraps all authenticated routes. `useIsReadOnly()` returns `true` when `role !== 'admin'`; all write actions in the UI are gated on this check.

| Path | Access |
|---|---|
| `/login` | Public |
| `/dashboard` | Authenticated |
| `/snapshots` | Authenticated |
| `/expenses` | Authenticated |
| `/regent` | Authenticated |
| `/zerodha` | Authenticated |
| `/todos` | Authenticated |
| `/admin` | Admin only |

### Todo Dependency System

`Todo.dependsOn` holds IDs of blocking todos. The utility at `src/utils/todoUtils.ts` is the single source of truth for "is this todo blocked":

```ts
getPendingBlockers(todo, allTodos)  // deps not yet done
isTodoBlocked(todo, allTodos)       // boolean shorthand
```

Key invariant: a dependency absent from the array (because it was filtered out as done) is treated as done — not as blocking. Always import from `todoUtils`; never inline this logic.

### Focus State Sync

Focus state is stored per-user in Firestore (`focusState/{uid}`) so it propagates across devices in real-time via `onSnapshot`. The hook writes only on user actions (start / pause / resume / stop) — never on every tick — keeping Firestore usage well within the free tier.

### Exchange Rates

Fetched from a public currency API, cached in Firestore for 4 hours. Falls back to hardcoded defaults if the fetch fails.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds and deploys to Firebase Hosting automatically. The Groq API key is read from a GitHub secret; all other Firebase config comes from repository variables.

## License

Private — not intended for public distribution.
