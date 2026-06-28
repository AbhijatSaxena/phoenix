# Phoenix

A personal finance dashboard. Built as a private, self-hosted web app for tracking net worth, expenses, and investments — all in one place.

## Features

### Net Worth Dashboard
- Track assets across categories: **liquid**, **appreciating**, and **depreciating**
- Automatic multi-currency conversion (USD, CAD, INR) with live exchange rates
- Derived accounts (property equity, stock portfolio, car value) computed automatically from their respective pages
- Quick-link chip bar for frequently visited external resources

### Snapshots
- Record daily net worth snapshots across all categories
- Visualise trends over time with a line chart
- Annotate each snapshot with free-form notes
- Duplicate-date detection: prompted to overwrite or add a new row when saving a second snapshot on the same day

### Expenses
- Monthly budget tracker per currency (INR, USD, CAD)
- Configurable line items with salary and spend tracking
- Drag-and-drop row reordering

### Property Tracker (Regent)
- Track property value using configurable rate parameters (base rate, floor rise premium, parking, GST, etc.)
- Optional "refunded if cancelled" toggle — applies a -20% cancellation deduction to the dashboard value
- Dynamic payments list: add, edit, and delete payments by label and amount
- Log EMI payments with full history
- Computed equity feeds back into the net worth dashboard automatically

### Car Tracker (Subaru)
- Track estimated selling price in USD
- Log expenditures (repairs, maintenance, etc.) with optional deduction toggle
- Net value (with or without deductions) flows into the net worth dashboard via live exchange rate

### Stock Portfolio (Zerodha)
- Track capital invested and realised/unrealised P&L across equity, F&O, commodities, and mutual funds
- Historical entry log with date-series view
- "Copy previous values" per field when adding a new entry; master checkbox to copy all at once

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
| Charts | Recharts |
| Drag-and-drop | dnd-kit |
| Hosting | Firebase Hosting |

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with **Authentication** and **Firestore** enabled

### Environment Variables

Create a `.env` file at the project root:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
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
  services/       # Firebase CRUD + exchange rates
  hooks/          # useInactivityLogout
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
| `/subaru` | Authenticated |
| `/admin` | Admin only |

### Derived Accounts

Three accounts in Firestore carry a `derived` field (`'regent'`, `'zerodha'`, `'subaruCar'`). Their values are never written directly — instead, `dashboardStore.load()` fetches the relevant config documents and patches the values in-memory before setting state. This keeps Firestore writes minimal and ensures the dashboard always reflects the latest config.

### Exchange Rates

Fetched from a public currency API, cached in Firestore for 4 hours. Falls back to hardcoded defaults (`usdInr: 84`, `cadInr: 62`) if the fetch fails.

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds and deploys to Firebase Hosting automatically. Firebase config comes from repository variables.

## License

Private — not intended for public distribution.
