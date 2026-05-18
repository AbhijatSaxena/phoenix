import { create } from 'zustand'
import type { User } from 'firebase/auth'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth, fetchUserRole } from '../services/firebase'

type Role = 'admin' | 'viewer'

interface AuthState {
  user: User | null
  role: Role | null
  authLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const role = await fetchUserRole(user.uid)
      set({ user, role, authLoading: false })
    } else {
      set({ user: null, role: null, authLoading: false })
    }
  })

  return {
    user: null,
    role: null,
    authLoading: true,

    signIn: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password)
    },

    signOut: async () => {
      await firebaseSignOut(auth)
    },
  }
})

export function useIsReadOnly(): boolean {
  return useAuthStore(s => s.role !== 'admin')
}
