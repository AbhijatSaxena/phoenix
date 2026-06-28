// ─── Dashboard ───────────────────────────────────────────────────────────────

export type Category = 'liquid' | 'appreciating' | 'depreciating'

export interface Account {
  id: string
  name: string
  category: Category
  usd: number
  cad: number
  inr: number
  order: number
  updatedAt?: number  // epoch ms, set on every edit
  /** Computed from Regent / Zerodha / SubaruCar pages. Marks it as read-only in UI. */
  derived?: 'regent' | 'zerodha' | 'subaruCar'
}

export interface Rates {
  usdInr: number
  cadInr: number
  fetchedAt: number // epoch ms
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

export interface Snapshot {
  id: string
  date: string         // ISO date string e.g. "2026-05-04"
  liquid: number
  appreciating: number
  depreciating: number
  total: number
  difference: number | null
  notes: string
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

// ─── Regent ──────────────────────────────────────────────────────────────────

export interface RegentConfig {
  sqft: number
  baseRate: number
  floorRisePremium: number
  premiumLocation: number
  carParking: number
  infraCharges: number
  clubHouseCharges: number
  principalOutstanding: number
  payments: RegentPayment[]
  totalTds: number
}

export interface RegentPayment {
  label: string
  amount: number
}

export interface RegentEmi {
  id: string
  date: string   // ISO date string
  amount: number
}

// ─── Subaru Car ──────────────────────────────────────────────────────────────

export interface SubaruExpenditure {
  label: string
  amount: number
}

export interface SubaruCarConfig {
  estimatedSellingPrice: number
  expenditures: SubaruExpenditure[]
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
