// ─── Dashboard ───────────────────────────────────────────────────────────────

export type Category = 'liquid' | 'appreciating' | 'investments' | 'depreciating'

export interface Account {
  id: string
  name: string
  category: Category
  usd: number
  cad: number
  inr: number
  order: number
  updatedAt?: number  // epoch ms, set on every edit
  /** Computed from Property / Zerodha / Car pages. Marks it as read-only in UI. */
  derived?: 'regent' | 'zerodha' | 'subaruCar'
}

export interface Rates {
  usdInr: number
  cadInr: number
  fetchedAt: number // epoch ms
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export interface SnapshotAccount {
  id: string
  name: string
  category: Category
  inr: number  // INR value at time of snapshot
}

export interface Snapshot {
  id: string
  date: string         // ISO date string e.g. "2026-05-04"
  version?: 1 | 2     // undefined or 1 = legacy V1; 2 = per-account detail stored
  liquid: number
  appreciating: number
  investments?: number // V2 only
  depreciating: number
  total: number
  difference: number | null
  notes: string
  accounts?: SnapshotAccount[]  // V2 only — per-account INR values at snapshot time
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export type Currency = 'INR' | 'USD' | 'CAD'

export interface ExpenseItem {
  name: string
  amount: number
}

export interface MonthExpenses {
  id: string           // e.g. "USD-2025-05"
  currency: Currency
  yearMonth: string    // e.g. "2025-05"
  salary: number
  items: ExpenseItem[]
}

// ─── Property ────────────────────────────────────────────────────────────────

export interface PropertyConfig {
  sqft: number
  baseRate: number
  floorRisePremium: number
  premiumLocation: number
  carParking: number
  infraCharges: number
  clubHouseCharges: number
  principalOutstanding: number
  bulkPayments: PropertyBulkPayment[]
  tdsPayments: PropertyBulkPayment[]
  loanDisbursements: PropertyBulkPayment[]
}

export interface PropertyBulkPayment {
  date: string
  amount: number
  mode: string
}

export interface PropertyEmi {
  id: string
  date: string   // ISO date string
  amount: number
}

// ─── Car ─────────────────────────────────────────────────────────────────────

export interface CarExpenditure {
  label: string
  amount: number
}

export interface CarConfig {
  estimatedSellingPrice: number
  expenditures: CarExpenditure[]
  includeExpenditures: boolean
}

// ─── Zerodha ─────────────────────────────────────────────────────────────────

export interface ZerodhaConfig {
  capital: number
}

// ─── Quick Links ─────────────────────────────────────────────────────────────

export interface QuickLink {
  id: string
  title: string
  url: string
  emoji: string
  order: number
}

export interface ZerodhaEntry {
  id: string
  date: string   // ISO date string
  equityRealized: number
  equityUnrealized: number
  fnoRealized: number
  fnoUnrealized: number
  commoditiesRealized: number
  commoditiesUnrealized: number
  mfRealized: number
  mfUnrealized: number
}
