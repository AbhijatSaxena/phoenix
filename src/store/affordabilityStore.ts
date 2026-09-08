import { create } from 'zustand'
import type { AffordabilityPlan } from '../types'
import {
  fetchAffordabilityPlans, saveAffordabilityPlan, deleteAffordabilityPlan,
} from '../services/firebase'

interface AffordabilityState {
  plans: AffordabilityPlan[]
  loading: boolean
  load: () => Promise<void>
  add: (name: string, target: number) => Promise<string>
  update: (plan: AffordabilityPlan) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useAffordabilityStore = create<AffordabilityState>((set, get) => ({
  plans: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const plans = await fetchAffordabilityPlans() as AffordabilityPlan[]
    set({ plans, loading: false })
  },

  add: async (name, target) => {
    const maxOrder = get().plans.reduce((m, p) => Math.max(m, p.order), -1)
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    const plan: AffordabilityPlan = {
      id, name, target, allocations: [], order: maxOrder + 1, updatedAt: Date.now(),
    }
    await saveAffordabilityPlan(plan as unknown as Record<string, unknown>)
    set(s => ({ plans: [...s.plans, plan] }))
    return id
  },

  update: async (plan) => {
    const stamped = { ...plan, updatedAt: Date.now() }
    await saveAffordabilityPlan(stamped as unknown as Record<string, unknown>)
    set(s => ({ plans: s.plans.map(p => p.id === plan.id ? stamped : p) }))
  },

  remove: async (id) => {
    await deleteAffordabilityPlan(id)
    set(s => ({ plans: s.plans.filter(p => p.id !== id) }))
  },
}))
