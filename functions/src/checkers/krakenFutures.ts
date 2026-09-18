import { createHash, createHmac } from 'node:crypto'
import { defineSecret } from 'firebase-functions/params'
import type { Checker } from '../checker'

// Kraken Futures is a separate platform from Spot: own wallet, own API host,
// own key pair (futures.kraken.com → Settings → API keys, "Read only").
// Set with: firebase functions:secrets:set KRAKEN_FUTURES_API_KEY / KRAKEN_FUTURES_API_SECRET
const KRAKEN_FUTURES_API_KEY    = defineSecret('KRAKEN_FUTURES_API_KEY')
const KRAKEN_FUTURES_API_SECRET = defineSecret('KRAKEN_FUTURES_API_SECRET')

const HOST = 'https://futures.kraken.com/derivatives'

/**
 * Futures auth differs from Spot: Authent = base64(HMAC-SHA512(SHA256(postData + nonce + path), base64decode(secret))).
 * `path` excludes the /derivatives prefix.
 */
async function futuresGet<T>(path: string): Promise<T> {
  const nonce = Date.now().toString()
  const digest = createHash('sha256').update('' + nonce + path).digest()
  const authent = createHmac('sha512', Buffer.from(KRAKEN_FUTURES_API_SECRET.value(), 'base64'))
    .update(digest)
    .digest('base64')

  const res = await fetch(HOST + path, {
    headers: { APIKey: KRAKEN_FUTURES_API_KEY.value(), Authent: authent, Nonce: nonce },
  })
  if (!res.ok) throw new Error(`Kraken Futures ${path} → HTTP ${res.status}`)
  const json = await res.json() as { result: string; error?: string } & T
  if (json.result !== 'success') throw new Error(`Kraken Futures ${path} → ${json.error ?? json.result}`)
  return json
}

interface Accounts {
  accounts: Record<string, {
    type: string
    /** multiCollateralMarginAccount: collateral + unrealised P&L, in USD */
    portfolioValue?: number
    /** cashAccount: per-asset balances, keyed by lowercase symbol */
    balances?: Record<string, number>
  }>
}

const USD_LIKE = new Set(['usd', 'usdt', 'usdc'])

export const krakenFutures: Checker = {
  id: 'krakenFutures',
  label: 'Kraken Futures balance',
  secrets: [KRAKEN_FUTURES_API_KEY, KRAKEN_FUTURES_API_SECRET],
  async run() {
    const { accounts } = await futuresGet<Accounts>('/api/v3/accounts')
    let usd = 0
    for (const [name, acct] of Object.entries(accounts)) {
      if (acct.type === 'multiCollateralMarginAccount' && typeof acct.portfolioValue === 'number') {
        usd += acct.portfolioValue
      } else if (acct.type === 'cashAccount' && acct.balances) {
        // Only stable USD balances can be added without a price feed; anything
        // else parked here is skipped and surfaced in the status error.
        const skipped = Object.entries(acct.balances).filter(([sym, v]) => !USD_LIKE.has(sym) && v !== 0)
        if (skipped.length) throw new Error(`cash account ${name} holds non-USD assets: ${skipped.map(([s]) => s).join(', ')}`)
        for (const [sym, v] of Object.entries(acct.balances)) if (USD_LIKE.has(sym)) usd += v
      }
      // Legacy single-collateral fi_* accounts are denominated in crypto; not supported.
    }
    if (!Number.isFinite(usd)) throw new Error('Kraken Futures → malformed accounts payload')
    return [{ kind: 'balance', provider: 'krakenFutures', usd: Math.round(usd * 100) / 100 }]
  },
}
