import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import type { Checker, CheckResult, SyncStatus } from './checker'

/**
 * Run every checker in isolation and persist what it produced. One checker
 * failing never blocks another; each records its own row in `meta/sync`.
 */
export async function runAll(checkers: Checker[]): Promise<Record<string, SyncStatus>> {
  const db = getFirestore()
  const statuses: Record<string, SyncStatus> = {}

  for (const checker of checkers) {
    const started = Date.now()
    try {
      const results = await checker.run()
      for (const r of results) await applyResult(r)
      statuses[checker.id] = { label: checker.label, at: started, ok: true, durationMs: Date.now() - started }
      logger.info(`checker ${checker.id} ok`, { results: results.length, durationMs: Date.now() - started })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      statuses[checker.id] = { label: checker.label, at: started, ok: false, error, durationMs: Date.now() - started }
      logger.error(`checker ${checker.id} failed`, { error })
    }
  }

  // merge: true so a partial run (or a future checker) never clobbers other rows
  await db.doc('meta/sync').set(statuses, { merge: true })
  return statuses
}

async function applyResult(r: CheckResult): Promise<void> {
  const db = getFirestore()

  if (r.kind === 'rates') {
    // Same shape `services/rates.ts` on the client already reads.
    await db.doc('meta/rates').set({ usdInr: r.usdInr, cadInr: r.cadInr, fetchedAt: Date.now() })
    return
  }

  // Balance → every account the user has pointed at this provider from the
  // Accounts page. Mapping lives in data, not here.
  const snap = await db.collection('accounts').where('sync.provider', '==', r.provider).get()
  if (snap.empty) {
    logger.warn(`no account has sync.provider == ${r.provider}; result dropped`)
    return
  }
  const now = Date.now()
  const patch: Record<string, unknown> = { updatedAt: now, 'sync.at': now, 'sync.ok': true, 'sync.error': FieldValue.delete() }
  if (r.usd !== undefined) patch.usd = r.usd
  if (r.cad !== undefined) patch.cad = r.cad
  if (r.inr !== undefined) patch.inr = r.inr

  const batch = db.batch()
  snap.docs.forEach(d => batch.update(d.ref, patch))
  await batch.commit()
}
