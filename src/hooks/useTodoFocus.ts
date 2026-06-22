import { useEffect, useState } from 'react'

const FOCUS_ID_KEY  = 'phoenix_focus_id'
const FOCUS_AT_KEY  = 'phoenix_focus_at'   // null when paused
const FOCUS_ACC_KEY = 'phoenix_focus_acc'  // accumulated ms before current session
const FOCUS_PAU_KEY = 'phoenix_focus_paused'

export function fmtElapsed(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function useTodoFocus() {
  const [focusedId, setFocusedId] = useState<string | null>(
    () => localStorage.getItem(FOCUS_ID_KEY)
  )
  const [focusedAt, setFocusedAt] = useState<number | null>(
    () => { const v = localStorage.getItem(FOCUS_AT_KEY); return v ? Number(v) : null }
  )
  const [accMs, setAccMs] = useState<number>(
    () => { const v = localStorage.getItem(FOCUS_ACC_KEY); return v ? Number(v) : 0 }
  )
  const [paused, setPaused] = useState<boolean>(
    () => localStorage.getItem(FOCUS_PAU_KEY) === '1'
  )
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    // When paused, show frozen accumulated time
    if (!focusedAt || paused) {
      setElapsed(Math.floor(accMs / 1000))
      return
    }
    const tick = () => setElapsed(Math.floor((accMs + Date.now() - focusedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [focusedAt, accMs, paused])

  function focus(id: string) {
    const now = Date.now()
    localStorage.setItem(FOCUS_ID_KEY, id)
    localStorage.setItem(FOCUS_AT_KEY, String(now))
    localStorage.setItem(FOCUS_ACC_KEY, '0')
    localStorage.removeItem(FOCUS_PAU_KEY)
    setFocusedId(id)
    setFocusedAt(now)
    setAccMs(0)
    setPaused(false)
  }

  function pause() {
    if (!focusedAt) return
    const newAcc = accMs + (Date.now() - focusedAt)
    localStorage.setItem(FOCUS_ACC_KEY, String(newAcc))
    localStorage.removeItem(FOCUS_AT_KEY)
    localStorage.setItem(FOCUS_PAU_KEY, '1')
    setAccMs(newAcc)
    setFocusedAt(null)
    setPaused(true)
  }

  function resume() {
    const now = Date.now()
    localStorage.setItem(FOCUS_AT_KEY, String(now))
    localStorage.removeItem(FOCUS_PAU_KEY)
    setFocusedAt(now)
    setPaused(false)
  }

  function unfocus() {
    localStorage.removeItem(FOCUS_ID_KEY)
    localStorage.removeItem(FOCUS_AT_KEY)
    localStorage.removeItem(FOCUS_ACC_KEY)
    localStorage.removeItem(FOCUS_PAU_KEY)
    setFocusedId(null)
    setFocusedAt(null)
    setAccMs(0)
    setPaused(false)
    setElapsed(0)
  }

  return { focusedId, elapsed, paused, focus, pause, resume, unfocus }
}
