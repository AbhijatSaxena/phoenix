import { create } from 'zustand'
import type { Account } from '../types'
import {
  fetchAccounts, saveAccount, deleteAccount,
  fetchZerodhaConfig, fetchRegentConfig, fetchSubaruCarConfig,
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
    const [rawAccounts, zerCfg, regCfg, subaruCfg] = await Promise.all([
      fetchAccounts(),
      fetchZerodhaConfig(),
      fetchRegentConfig(),
      fetchSubaruCarConfig(),
    ])

    // Zerodha: show capital invested only
    const zerodhaValue = (zerCfg as any)?.capital ?? 0

    // Compute live Regent value: "I get to keep" = refunded - principalOutstanding
    const rc = regCfg as any
    let regentValue = 0
    if (rc) {
      const baseTotal = rc.sqft * rc.baseRate
      const totalCost = baseTotal + rc.floorRisePremium + rc.premiumLocation
                      + rc.carParking + rc.infraCharges + rc.clubHouseCharges
      regentValue = totalCost * 1.05 * 0.80 - rc.principalOutstanding
    }

    // Compute Subaru Car net value
    const sc = subaruCfg as any
    let subaruValue = 0
    if (sc) {
      const totalExp = (sc.expenditures ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
      subaruValue = (sc.estimatedSellingPrice ?? 0) - totalExp
    }

    // Patch derived accounts in-memory (no Firestore write)
    const accounts = (rawAccounts as Account[]).map(a => {
      if (a.derived === 'zerodha')   return { ...a, inr: zerodhaValue }
      if (a.derived === 'regent')    return { ...a, inr: regentValue }
      if (a.derived === 'subaruCar') return { ...a, usd: subaruValue, inr: 0 }
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
