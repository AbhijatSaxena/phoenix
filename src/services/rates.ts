import { fetchCachedRates, saveCachedRates } from './firebase'
import type { Rates } from '../types'

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

export async function getExchangeRates(): Promise<Rates> {
  let stale: Rates | null = null

  // 1. Try Firestore cache — return immediately if fresh, keep stale copy as fallback
  try {
    const cached = await fetchCachedRates() as (Rates & { fetchedAt: number }) | null
    if (cached) {
      if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return { usdInr: cached.usdInr, cadInr: cached.cadInr, fetchedAt: cached.fetchedAt }
      }
      stale = { usdInr: cached.usdInr, cadInr: cached.cadInr, fetchedAt: cached.fetchedAt }
    }
  } catch {
    // Firestore unavailable — fall through to live fetch
  }

  // 2. Fetch live rates
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
    )
    const data = await res.json()
    const usdInr: number = Math.round(data.usd.inr * 100) / 100
    const cadInr: number = Math.round((data.usd.inr / data.usd.cad) * 100) / 100

    const rates: Rates = { usdInr, cadInr, fetchedAt: Date.now() }

    // 3. Cache to Firestore (fire-and-forget)
    saveCachedRates(rates).catch(() => {})

    return rates
  } catch {
    // 4. Live fetch failed — use stale Firestore data if available, else last-resort defaults
    return stale ?? { usdInr: 84.0, cadInr: 62.0, fetchedAt: 0 }
  }
}
