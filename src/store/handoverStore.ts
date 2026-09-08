import { create } from 'zustand'
import type { HandoverNote } from '../types'
import { fetchHandoverNotes, saveHandoverNote, deleteHandoverNote } from '../services/firebase'

interface HandoverState {
  notes: HandoverNote[]
  loading: boolean
  load: () => Promise<void>
  add: (title: string) => Promise<string>
  update: (note: HandoverNote) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useHandoverStore = create<HandoverState>((set, get) => ({
  notes: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const rows = await fetchHandoverNotes() as HandoverNote[]
    set({ notes: rows, loading: false })
  },

  add: async (title: string) => {
    const maxOrder = get().notes.reduce((m, n) => Math.max(m, n.order), -1)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    const note: HandoverNote = {
      id, title, content: '', order: maxOrder + 1, updatedAt: Date.now(),
    }
    await saveHandoverNote(note as unknown as Record<string, unknown>)
    set(s => ({ notes: [...s.notes, note] }))
    return id
  },

  update: async (note: HandoverNote) => {
    const stamped = { ...note, updatedAt: Date.now() }
    await saveHandoverNote(stamped as unknown as Record<string, unknown>)
    set(s => ({ notes: s.notes.map(n => n.id === note.id ? stamped : n) }))
  },

  remove: async (id: string) => {
    await deleteHandoverNote(id)
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }))
  },
}))
