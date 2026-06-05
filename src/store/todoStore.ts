import { create } from 'zustand'
import type { Todo } from '../types'
import { fetchTodos, fetchArchivedTodos, saveTodo, deleteTodo } from '../services/firebase'

interface TodoState {
  todos: Todo[]
  archivedTodos: Todo[]
  loading: boolean
  loadingArchived: boolean
  load: () => Promise<void>
  loadArchived: () => Promise<void>
  add: (text: string) => Promise<Todo>
  update: (todo: Todo) => Promise<void>
  remove: (id: string) => Promise<void>
  archive: (id: string) => Promise<void>
  unarchive: (id: string) => Promise<void>
  reorder: (todos: Todo[]) => Promise<void>
  bumpCommentCount: (id: string, delta: 1 | -1) => void
  setCommentCount: (id: string, count: number) => void
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  archivedTodos: [],
  loading: false,
  loadingArchived: false,

  load: async () => {
    set({ loading: true })
    const todos = await fetchTodos() as Todo[]
    set({ todos, loading: false })
  },

  loadArchived: async () => {
    set({ loadingArchived: true })
    const archivedTodos = await fetchArchivedTodos() as Todo[]
    set({ archivedTodos, loadingArchived: false })
  },

  add: async (text: string) => {
    const todos = get().todos
    const order = todos.length > 0 ? Math.max(...todos.map(t => t.order)) + 1 : 0
    const todo: Todo = { id: newId(), text, order, done: false }
    await saveTodo(todo as unknown as Record<string, unknown>)
    set(state => ({ todos: [...state.todos, todo] }))
    return todo
  },

  update: async (todo: Todo) => {
    await saveTodo(todo as unknown as Record<string, unknown>)
    set(state => ({ todos: state.todos.map(t => t.id === todo.id ? todo : t) }))
  },

  remove: async (id: string) => {
    await deleteTodo(id)
    set(state => ({
      todos: state.todos.filter(t => t.id !== id),
      archivedTodos: state.archivedTodos.filter(t => t.id !== id),
    }))
  },

  archive: async (id: string) => {
    const todo = get().todos.find(t => t.id === id)
    if (!todo) return
    const archived = { ...todo, archived: true }
    await saveTodo(archived as unknown as Record<string, unknown>)
    set(state => ({ todos: state.todos.filter(t => t.id !== id) }))
  },

  unarchive: async (id: string) => {
    const todo = get().archivedTodos.find(t => t.id === id)
    if (!todo) return
    const active = { ...todo, archived: false }
    await saveTodo(active as unknown as Record<string, unknown>)
    set(state => ({
      archivedTodos: state.archivedTodos.filter(t => t.id !== id),
      todos: [...state.todos, active],
    }))
  },

  reorder: async (todos: Todo[]) => {
    const reindexed = todos.map((t, i) => ({ ...t, order: i }))
    set({ todos: reindexed })
    await Promise.all(reindexed.map(t => saveTodo(t as unknown as Record<string, unknown>)))
  },

  bumpCommentCount: (id: string, delta: 1 | -1) => {
    set(state => ({
      todos: state.todos.map(t =>
        t.id === id ? { ...t, commentCount: Math.max(0, (t.commentCount ?? 0) + delta) } : t
      ),
    }))
  },

  setCommentCount: (id: string, count: number) => {
    set(state => ({
      todos: state.todos.map(t => t.id === id ? { ...t, commentCount: count } : t),
    }))
  },
}))
