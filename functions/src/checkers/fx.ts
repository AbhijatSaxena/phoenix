import type { Checker } from '../checker'

// Same source the client used before rates moved server-side. Free, no key,
// daily-updated. Falls back to the mirror host if the CDN is down.
const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
]

export const fx: Checker = {
  id: 'fx',
  label: 'FX rates (USD/INR, CAD/INR)',
  async run() {
    let lastErr: unknown
    for (const url of SOURCES) {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
        const data = await res.json() as { usd: { inr: number; cad: number } }
        const inr = data.usd?.inr
        const cad = data.usd?.cad
        if (!(inr > 0) || !(cad > 0)) throw new Error(`${url} → malformed payload`)
        return [{
          kind: 'rates',
          usdInr: Math.round(inr * 100) / 100,
          cadInr: Math.round((inr / cad) * 100) / 100,
        }]
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
  },
}
