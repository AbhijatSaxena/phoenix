import { create } from 'zustand'
import type { Account } from '../types'
import {
  fetchAccounts, saveAccount, deleteAccount,
  fetchZerodhaConfig, fetchPropertyConfig, fetchCarConfig,
} from '../services/firebase'

interface DashboardState {
  accounts: Account[]
  loading: boolean
  load: () => Promise<void>
  update: (account: Account) => Promise<void>
  remove: (id: string) => Promise<void>
  add: (account: Account) => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  accounts: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const [rawAccounts, zerCfg, propCfg, carCfg] = await Promise.all([
      fetchAccounts(),
      fetchZerodhaConfig(),
      fetchPropertyConfig(),
      fetchCarConfig(),
    ])

    // Zerodha: show capital invested only
    const zerodhaValue = (zerCfg as any)?.capital ?? 0

    // Compute live Property value
    const rc = propCfg as any
    let propertyValue = 0
    if (rc) {
      const baseTotal = rc.sqft * rc.baseRate
      const totalCost = baseTotal + rc.floorRisePremium + rc.premiumLocation
                      + rc.carParking + rc.infraCharges + rc.clubHouseCharges
      const withGst   = totalCost * 1.05
      // Apply -20% cancellation deduction only when the flag is on
      const effectiveValue = rc.includeRefund ? withGst * 0.80 : withGst
      propertyValue = effectiveValue - rc.principalOutstanding
    }

    // Compute Car value — deduct expenditures only when the flag is on
    const sc = carCfg as any
    let carValue = 0
    if (sc) {
      const totalExp = (sc.expenditures ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
      carValue = (sc.estimatedSellingPrice ?? 0) - (sc.includeExpenditures ? totalExp : 0)
    }

    // Patch derived accounts in-memory (no Firestore write)
    const accounts = (rawAccounts as Account[]).map(a => {
      if (a.derived === 'zerodha')  return { ...a, inr: zerodhaValue }
      if (a.derived === 'property') return { ...a, inr: propertyValue }
      if (a.derived === 'car')      return { ...a, usd: carValue, inr: 0 }
      return a
    })

    set({ accounts, loading: false })
  },

  update: async (account: Account) => {
    const stamped = { ...account, updatedAt: Date.now() }
    await saveAccount(stamped as unknown as Record<string, unknown>)
    set(state => ({
      accounts: state.accounts.map(a => a.id === account.id ? stamped : a),
    }))
  },

  remove: async (id: string) => {
    await deleteAccount(id)
    set(state => ({ accounts: state.accounts.filter(a => a.id !== id) }))
  },

  add: async (account: Account) => {
    await saveAccount(account as unknown as Record<string, unknown>)
    set(state => ({
      accounts: [...state.accounts, account].sort((a, b) => a.order - b.order),
    }))
  },
}))

// Helpers
export function computeNetInr(account: Account, usdInr: number, cadInr: number): number {
  return account.usd * usdInr + account.cad * cadInr + account.inr
}
