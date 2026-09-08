import { create } from 'zustand'
import type { Snapshot, SnapshotAccount } from '../types'
import { fetchSnapshots, upsertSnapshot, deleteSnapshot } from '../services/firebase'

interface SnapshotState {
  snapshots: Snapshot[]
  loading: boolean
  load: () => Promise<void>
  checkTodayExists: () => boolean
  saveSnapshot: (
    liquid: number,
    appreciating: number,
    investments: number,
    depreciating: number,
    notes: string,
    overwrite: boolean,
    accountsSnapshot: SnapshotAccount[]
  ) => Promise<void>
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

  saveSnapshot: async (liquid, appreciating, investments, depreciating, notes, overwrite, accountsSnapshot) => {
    const today = todayIso()
    const total = liquid + appreciating + investments + depreciating

    let existing = get().snapshots
    if (existing.length === 0) {
      existing = await fetchSnapshots() as Snapshot[]
      set({ snapshots: existing })
    }

    const existingToday = existing.find(s => s.date === today)

    let id: string
    if (existingToday && overwrite) {
      id = existingToday.id
    } else {
      id = existingToday ? `${today}-${Date.now().toString(36)}` : today
    }

    // Always recompute against the most recent snapshot other than the row being
    // written. On overwrite the existing row's own difference is stale, since the
    // totals it was derived from are the ones being replaced.
    const prior      = existing.filter(s => s.id !== id)
    const prevEntry  = prior.length > 0 ? prior[prior.length - 1] : null
    const difference = prevEntry ? total - prevEntry.total : null

    const snapshot: Snapshot = {
      id,
      date: today,
      version: 2,
      liquid,
      appreciating,
      investments,
      depreciating,
      total,
      difference,
      notes,
      accounts: accountsSnapshot,
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
