import type { AccountSync, SyncStatus } from '../types'

/** The worker runs every 4h; 36h means several runs missed — worth a warning. */
export const SYNC_STALE_MS = 36 * 60 * 60 * 1000

export function isStale(at: number | undefined): boolean {
  return !at || Date.now() - at > SYNC_STALE_MS
}

export function accountSyncHealthy(sync: AccountSync): boolean {
  return sync.ok !== false && !isStale(sync.at)
}

export function statusHealthy(s: SyncStatus): boolean {
  return s.ok && !isStale(s.at)
}
