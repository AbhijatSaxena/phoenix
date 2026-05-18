import { create } from 'zustand'
import type { Snapshot } from '../types'
import { fetchSnapshots, upsertSnapshot, deleteSnapshot } from '../services/firebase'

interface SnapshotState {
  snapshots: Snapshot[]
  loading: boolean
  load: () => Promise<void>
  saveSnapshot: (liquid: number, appreciating: number, depreciating: number, notes: string) => Promise<void>
  updateSnapshot: (snapshot: Snapshot) => Promise<void>
  removeSnapshot: (id: string) => Promise<void>
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const snapshots = await fetchSnapshots() as Snapshot[]
    set({ snapshots, loading: false })
  },

  saveSnapshot: async (liquid, appreciating, depreciating, notes) => {
    const today = todayIso()
    const total = liquid + appreciating + depreciating

    // Always fetch fresh snapshots so diff is correct even if not pre-loaded
    let existing = get().snapshots
    if (existing.length === 0) {
      existing = await fetchSnapshots() as Snapshot[]
      set({ snapshots: existing })
    }
    const prevTotal = existing.length > 0
      ? existing[existing.length - 1].total
      : null

    // Check if today already exists
    const existingToday = existing.find(s => s.date === today)
    const id = existingToday?.id ?? today

    const difference = existingToday
      ? existingToday.difference   // keep original difference if updating today
      : (prevTotal !== null ? total - prevTotal : null)

    const snapshot: Snapshot = {
      id,
      date: today,
      liquid,
      appreciating,
      depreciating,
      total,
      difference,
      notes: notes || (existingToday?.notes ?? ''),
    }

    await upsertSnapshot(snapshot as unknown as Record<string, unknown>)

    set(state => {
      const without = state.snapshots.filter(s => s.id !== id)
      return { snapshots: [...without, snapshot].sort((a, b) => a.date.localeCompare(b.date)) }
    })
  },

  updateSnapshot: async (snapshot: Snapshot) => {
    await upsertSnapshot(snapshot as unknown as Record<string, unknown>)
    set(state => {
      const without = state.snapshots.filter(s => s.id !== snapshot.id)
      return { snapshots: [...without, snapshot].sort((a, b) => a.date.localeCompare(b.date)) }
    })
  },

  removeSnapshot: async (id: string) => {
    await deleteSnapshot(id)
    set(state => ({ snapshots: state.snapshots.filter(s => s.id !== id) }))
  },
}))
