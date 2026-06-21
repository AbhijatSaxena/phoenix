import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

const TIMEOUT_MS    = 60 * 60 * 1000  // 1 hour of inactivity
const LAST_ACT_KEY  = 'phoenix_last_activity'
const THROTTLE_MS   = 30_000           // write localStorage at most every 30s

export function useInactivityLogout() {
  const user    = useAuthStore(s => s.user)
  const signOut = useAuthStore(s => s.signOut)

  useEffect(() => {
    if (!user) return

    let timer: ReturnType<typeof setTimeout>
    let lastWrite = 0

    function resetTimer() {
      clearTimeout(timer)
      const now = Date.now()
      if (now - lastWrite > THROTTLE_MS) {
        localStorage.setItem(LAST_ACT_KEY, now.toString())
        lastWrite = now
      }
      timer = setTimeout(signOut, TIMEOUT_MS)
    }

    // When tab becomes visible again, check if the idle window already passed
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      const last = parseInt(localStorage.getItem(LAST_ACT_KEY) ?? '0', 10)
      if (Date.now() - last > TIMEOUT_MS) { signOut(); return }
      resetTimer()
    }

    const EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const
    EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    document.addEventListener('visibilitychange', onVisibilityChange)

    resetTimer()  // start the clock

    return () => {
      clearTimeout(timer)
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer))
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [user?.uid])  // re-run only when the logged-in user changes
}
