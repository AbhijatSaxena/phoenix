import { fetchCachedRates, saveCachedRates } from './firebase'
import type { Rates } from '../types'

const CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

export async function getExchangeRates(): Promise<Rates> {
  // 1. Try Firestore cache first
  try {
    const cached = await fetchCachedRates() as (Rates & { fetchedAt: number }) | null
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { usdInr: cached.usdInr, cadInr: cached.cadInr, fetchedAt: cached.fetchedAt }
    }
  } catch {
    // Firestore unavailable — fall through to live fetch
  }

  // 2. Fetch live rates from cdn.jsdelivr.net/@fawazahmed0/currency-api (CDN, no CORS issues)
  try {
    const res = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
    )
    const data = await res.json()
    // data.usd contains rates keyed by lowercase currency code
    const usdInr: number = Math.round(data.usd.inr * 100) / 100
    const cadInr: number = Math.round((data.usd.inr / data.usd.cad) * 100) / 100

    const rates: Rates = {
      usdInr,
      cadInr,
      fetchedAt: Date.now(),
    }

    // 3. Cache to Firestore (fire-and-forget)
    saveCachedRates(rates).catch(() => {})

    return rates
  } catch {
    // 4. Fallback to last-known values if both cache and network fail
    return { usdInr: 84.0, cadInr: 62.0, fetchedAt: 0 }
  }
}
