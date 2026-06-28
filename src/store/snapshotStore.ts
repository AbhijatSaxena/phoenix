import { create } from 'zustand'
import type { Snapshot } from '../types'
import { fetchSnapshots, upsertSnapshot, deleteSnapshot } from '../services/firebase'

interface SnapshotState {
  snapshots: Snapshot[]
  loading: boolean
  load: () => Promise<void>
  checkTodayExists: () => boolean
  saveSnapshot: (liquid: number, appreciating: number, depreciating: number, notes: string, overwrite: boolean) => Promise<void>
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

  checkTodayExists: () => {
    const today = todayIso()
    return get().snapshots.some(s => s.date === today)
  },

  saveSnapshot: async (liquid, appreciating, depreciating, notes, overwrite) => {
    const today = todayIso()
    const total = liquid + appreciating + depreciating

    // Always fetch fresh snapshots so diff is correct even if not pre-loaded
    let existing = get().snapshots
    if (existing.length === 0) {
      existing = await fetchSnapshots() as Snapshot[]
      set({ snapshots: existing })
    }

    const existingToday = existing.find(s => s.date === today)

    let id: string
    let difference: number | null

    if (existingToday && overwrite) {
      // Overwrite: keep same document ID and preserve the original diff (vs previous day)
      id = existingToday.id
      difference = existingToday.difference
    } else {
      // New row: unique ID; diff vs the immediately preceding snapshot (may be today's earlier one)
      id = existingToday ? `${today}-${Date.now().toString(36)}` : today
      const prevEntry = existing.length > 0 ? existing[existing.length - 1] : null
      difference = prevEntry ? total - prevEntry.total : null
    }

    const snapshot: Snapshot = {
      id,
      date: today,
      liquid,
      appreciating,
      depreciating,
      total,
      difference,
      notes,
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
