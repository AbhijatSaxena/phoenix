import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { saveFocusState, clearFocusState, watchFocusState, type FocusStateDoc } from '../services/firebase'

export function fmtMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return `${m}m`
  return '< 1m'
}

const NULL_DOC: FocusStateDoc = { focusId: null, focusAt: null, focusAcc: 0, focusPaused: false }

export function useTodoFocus() {
  const uid = useAuthStore(s => s.user?.uid ?? null)
  const [focusDoc, setFocusDoc] = useState<FocusStateDoc>(NULL_DOC)

  useEffect(() => {
    // Remove legacy localStorage keys from the old implementation
    ;['phoenix_focus_id', 'phoenix_focus_at', 'phoenix_focus_acc', 'phoenix_focus_paused'].forEach(k =>
      localStorage.removeItem(k)
    )
  }, [])

  useEffect(() => {
    if (!uid) { setFocusDoc(NULL_DOC); return }
    return watchFocusState(uid, state => setFocusDoc(state ?? NULL_DOC))
  }, [uid])

  async function focus(id: string) {
    if (!uid) return
    await saveFocusState(uid, { focusId: id, focusAt: Date.now(), focusAcc: 0, focusPaused: false })
  }

  async function pause() {
    if (!uid || !focusDoc.focusAt) return
    const newAcc = focusDoc.focusAcc + (Date.now() - focusDoc.focusAt)
    await saveFocusState(uid, { focusId: focusDoc.focusId, focusAt: null, focusAcc: newAcc, focusPaused: true })
  }

  async function resume() {
    if (!uid) return
    await saveFocusState(uid, { focusId: focusDoc.focusId, focusAt: Date.now(), focusAcc: focusDoc.focusAcc, focusPaused: false })
  }

  async function unfocus(): Promise<{ id: string | null; totalMs: number }> {
    const id = focusDoc.focusId
    const totalMs = focusDoc.focusAcc + (!focusDoc.focusPaused && focusDoc.focusAt ? Date.now() - focusDoc.focusAt : 0)
    if (uid) await clearFocusState(uid)
    return { id, totalMs }
  }

  return {
    focusedId: focusDoc.focusId,
    paused: focusDoc.focusPaused,
    accMs: focusDoc.focusAcc,
    focus,
    pause,
    resume,
    unfocus,
  }
}
