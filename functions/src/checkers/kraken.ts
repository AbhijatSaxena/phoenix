import { createHash, createHmac } from 'node:crypto'
import { defineSecret } from 'firebase-functions/params'
import type { Checker } from '../checker'

// Key needs only read permissions: Funds → Query, Orders & trades → Query.
// Set with: firebase functions:secrets:set KRAKEN_API_KEY / KRAKEN_API_SECRET
const KRAKEN_API_KEY    = defineSecret('KRAKEN_API_KEY')
const KRAKEN_API_SECRET = defineSecret('KRAKEN_API_SECRET')

const HOST = 'https://api.kraken.com'

/**
 * Kraken private REST: API-Sign = base64(HMAC-SHA512(path + SHA256(nonce + body), base64decode(secret))).
 */
async function krakenPrivate<T>(path: string, params: Record<string, string>): Promise<T> {
  const nonce = Date.now().toString()
  const body = new URLSearchParams({ nonce, ...params }).toString()
  const digest = createHash('sha256').update(nonce + body).digest()
  const sign = createHmac('sha512', Buffer.from(KRAKEN_API_SECRET.value(), 'base64'))
    .update(Buffer.concat([Buffer.from(path), digest]))
    .digest('base64')

  const res = await fetch(HOST + path, {
    method: 'POST',
    headers: {
      'API-Key': KRAKEN_API_KEY.value(),
      'API-Sign': sign,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) throw new Error(`Kraken ${path} → HTTP ${res.status}`)
  const json = await res.json() as { error: string[]; result: T }
  if (json.error?.length) throw new Error(`Kraken ${path} → ${json.error.join('; ')}`)
  return json.result
}

export const kraken: Checker = {
  id: 'kraken',
  label: 'Kraken balance',
  secrets: [KRAKEN_API_KEY, KRAKEN_API_SECRET],
  async run() {
    // `eb` = equivalent balance: every asset on the account valued in `asset`.
    const r = await krakenPrivate<{ eb: string }>('/0/private/TradeBalance', { asset: 'ZUSD' })
    const usd = Number(r.eb)
    if (!Number.isFinite(usd)) throw new Error(`Kraken TradeBalance → malformed eb "${r.eb}"`)
    return [{ kind: 'balance', provider: 'kraken', usd: Math.round(usd * 100) / 100 }]
  },
}
