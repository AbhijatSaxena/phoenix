/**
 * A checker fetches one external fact (an FX pair, an exchange balance) and
 * returns results for `apply.ts` to write. Checkers never touch Firestore
 * themselves, so adding one is: new file in `checkers/`, one line in
 * `registry.ts`, and (if it needs a key) one secret.
 */

import type { SecretParam } from 'firebase-functions/params'

/** Identifier stored on an account doc as `sync.provider`. Frozen once used. */
export type SyncProvider = 'kraken' | 'cryptocom' | 'robinhood'

export type CheckResult =
  | { kind: 'rates'; usdInr: number; cadInr: number }
  /** Balance in the account's native currencies. Fields not given are left as-is. */
  | { kind: 'balance'; provider: SyncProvider; usd?: number; cad?: number; inr?: number }

export interface Checker {
  /** Key in `meta/sync` and in logs. Frozen once used. */
  id: string
  /** Human label for the Admin table. */
  label: string
  /**
   * Secret Manager params this checker reads. index.ts binds the union of all
   * checkers' secrets to both functions, so a missing secret fails the deploy
   * loudly rather than the run silently.
   */
  secrets?: SecretParam[]
  run(): Promise<CheckResult[]>
}

/** Per-checker outcome, written to `meta/sync.{id}`. */
export interface SyncStatus {
  label: string
  at: number          // epoch ms of this run
  ok: boolean
  error?: string
  durationMs: number
}
