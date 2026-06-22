import { useEffect, useState } from 'react'

const FOCUS_ID_KEY = 'phoenix_focus_id'
const FOCUS_AT_KEY = 'phoenix_focus_at'

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
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!focusedAt) { setElapsed(0); return }
    setElapsed(Math.floor((Date.now() - focusedAt) / 1000))
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - focusedAt) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [focusedAt])

  function focus(id: string) {
    const now = Date.now()
    localStorage.setItem(FOCUS_ID_KEY, id)
    localStorage.setItem(FOCUS_AT_KEY, String(now))
    setFocusedId(id)
    setFocusedAt(now)
  }

  function unfocus() {
    localStorage.removeItem(FOCUS_ID_KEY)
    localStorage.removeItem(FOCUS_AT_KEY)
    setFocusedId(null)
    setFocusedAt(null)
    setElapsed(0)
  }

  return { focusedId, elapsed, focus, unfocus }
}
