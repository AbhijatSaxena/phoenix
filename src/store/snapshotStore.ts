import { create } from 'zustand'
import type { Snapshot, SnapshotAccount } from '../types'
import { fetchSnapshots, upsertSnapshot, deleteSnapshot } from '../services/firebase'

interface SnapshotState {
  snapshots: Snapshot[]
  loading: boolean
  loaded: boolean
  load: () => Promise<void>
  findTodaySnapshot: () => Promise<Snapshot | null>
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

// Local calendar date, not UTC — toISOString() would file a snapshot saved
// before 05:30 IST under the previous day.
function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true })
    const snapshots = await fetchSnapshots() as Snapshot[]
    set({ snapshots, loading: false, loaded: true })
  },

  // Async and self-loading: callers may not have loaded the store, and an
  // unloaded store must not be mistaken for "no snapshot exists today".
  // Returns the row itself so callers can show what an overwrite would replace.
  findTodaySnapshot: async () => {
    if (!get().loaded) await get().load()
    const today = todayIso()
    return get().snapshots.find(s => s.date === today) ?? null
  },

  saveSnapshot: async (liquid, appreciating, investments, depreciating, notes, overwrite, accountsSnapshot) => {
    const today = todayIso()
    const total = liquid + appreciating + investments + depreciating

    if (!get().loaded) await get().load()
    const existing = get().snapshots

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
