import { create } from 'zustand'
import type { User } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  auth, fetchUserRole,
  createSession, updateSessionLastSeen, deleteSession, watchSession,
} from '../services/firebase'

type Role = 'admin' | 'viewer'

interface AuthState {
  user: User | null
  role: Role | null
  authLoading: boolean
  sessionId: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

let _sessionId: string | null = null
let _stopWatchSession: (() => void) | null = null
let _lastSeenInterval: ReturnType<typeof setInterval> | null = null

function cleanup() {
  if (_stopWatchSession) { _stopWatchSession(); _stopWatchSession = null }
  if (_lastSeenInterval) { clearInterval(_lastSeenInterval); _lastSeenInterval = null }
  if (_sessionId) { deleteSession(_sessionId).catch(() => {}); _sessionId = null }
}

export const useAuthStore = create<AuthState>((set) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const role = await fetchUserRole(user.uid)
      const sessionId = await createSession(user.uid, user.email ?? '', navigator.userAgent)
      _sessionId = sessionId

      _stopWatchSession = watchSession(sessionId, () => {
        cleanup()
        firebaseSignOut(auth)
      })

      _lastSeenInterval = setInterval(() => {
        if (_sessionId) updateSessionLastSeen(_sessionId).catch(() => {})
      }, 5 * 60 * 1000)

      set({ user, role, authLoading: false, sessionId })
    } else {
      cleanup()
      set({ user: null, role: null, authLoading: false, sessionId: null })
    }
  })

  return {
    user: null,
    role: null,
    authLoading: true,
    sessionId: null,

    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password)
    },

    signOut: async () => {
      cleanup()
      await firebaseSignOut(auth)
    },
  }
})

export function useIsReadOnly(): boolean {
  return useAuthStore(s => s.role !== 'admin')
}
