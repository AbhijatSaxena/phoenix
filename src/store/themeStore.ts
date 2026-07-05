import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  mode: 'dark' | 'light'
  toggleMode: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      mode: 'dark',
      toggleMode: () => set(s => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'phoenix-theme' }
  )
)
