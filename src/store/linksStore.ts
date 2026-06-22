import { create } from 'zustand'
import type { QuickLink } from '../types'
import { fetchLinks, saveLink, deleteLink } from '../services/firebase'

interface LinksState {
  links: QuickLink[]
  loading: boolean
  load: () => Promise<void>
  add: (title: string, url: string, emoji: string) => Promise<void>
  update: (link: QuickLink) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useLinksStore = create<LinksState>((set, get) => ({
  links: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const rows = await fetchLinks() as QuickLink[]
    set({ links: rows, loading: false })
  },

  add: async (title, url, emoji) => {
    const maxOrder = get().links.reduce((m, l) => Math.max(m, l.order), -1)
    const id = await saveLink({ title, url, emoji, order: maxOrder + 1 })
    const link: QuickLink = { id, title, url, emoji, order: maxOrder + 1 }
    set(s => ({ links: [...s.links, link] }))
  },

  update: async (link) => {
    await saveLink(link)
    set(s => ({ links: s.links.map(l => l.id === link.id ? link : l) }))
  },

  remove: async (id) => {
    await deleteLink(id)
    set(s => ({ links: s.links.filter(l => l.id !== id) }))
  },
}))
