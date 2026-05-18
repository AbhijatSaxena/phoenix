import { create } from 'zustand'
import type { Todo } from '../types'
import { fetchTodos, saveTodo, deleteTodo } from '../services/firebase'

interface TodoState {
  todos: Todo[]
  loading: boolean
  load: () => Promise<void>
  add: (text: string) => Promise<void>
  update: (todo: Todo) => Promise<void>
  remove: (id: string) => Promise<void>
  reorder: (todos: Todo[]) => Promise<void>
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    const todos = await fetchTodos() as Todo[]
    set({ todos, loading: false })
  },

  add: async (text: string) => {
    const todos = get().todos
    const order = todos.length > 0 ? Math.max(...todos.map(t => t.order)) + 1 : 0
    const todo: Todo = { id: newId(), text, order, done: false }
    await saveTodo(todo as unknown as Record<string, unknown>)
    set(state => ({ todos: [...state.todos, todo] }))
  },

  update: async (todo: Todo) => {
    await saveTodo(todo as unknown as Record<string, unknown>)
    set(state => ({ todos: state.todos.map(t => t.id === todo.id ? todo : t) }))
  },

  remove: async (id: string) => {
    await deleteTodo(id)
    set(state => ({ todos: state.todos.filter(t => t.id !== id) }))
  },

  reorder: async (todos: Todo[]) => {
    const reindexed = todos.map((t, i) => ({ ...t, order: i }))
    set({ todos: reindexed })
    await Promise.all(reindexed.map(t => saveTodo(t as unknown as Record<string, unknown>)))
  },
}))
