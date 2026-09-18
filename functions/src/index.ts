import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { checkers } from './registry'
import { runAll } from './apply'

initializeApp()

const secrets = checkers.flatMap(c => c.secrets ?? [])

/** Scheduled sync. IST so a run lands at a sane local hour and log times read naturally. */
export const syncScheduled = onSchedule(
  { schedule: 'every 4 hours', timeZone: 'Asia/Kolkata', timeoutSeconds: 120, secrets },
  async () => { await runAll(checkers) },
)

/** "Run now" from the Admin page. Admin-only — mirrors the Firestore write rule. */
export const syncNow = onCall({ timeoutSeconds: 120, secrets }, async (req) => {
  const uid = req.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first')
  const user = await getFirestore().doc(`users/${uid}`).get()
  if (user.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Admin only')
  return runAll(checkers)
})
