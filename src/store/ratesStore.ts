import { create } from 'zustand'
import type { Rates } from '../types'
import { getExchangeRates } from '../services/rates'

interface RatesState {
  rates: Rates | null
  loading: boolean
  loadRates: () => Promise<void>
}

export const useRatesStore = create<RatesState>((set) => ({
  rates: null,
  loading: false,
  loadRates: async () => {
    set({ loading: true })
    const rates = await getExchangeRates()
    set({ rates, loading: false })
  },
}))
