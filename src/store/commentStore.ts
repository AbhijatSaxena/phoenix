import { create } from 'zustand'
import type { TodoComment } from '../types'
import { fetchComments, addComment, deleteComment, bumpCommentCount, setCommentCount, auth } from '../services/firebase'
import { useTodoStore } from './todoStore'

interface CommentState {
  comments: TodoComment[]
  loading: boolean
  todoId: string | null
  load: (todoId: string) => Promise<void>
  add: (text: string) => Promise<void>
  remove: (commentId: string) => Promise<void>
}

export const useCommentStore = create<CommentState>((set, get) => ({
  comments: [],
  loading: false,
  todoId: null,

  load: async (todoId: string) => {
    set({ loading: true, todoId, comments: [] })
    const comments = await fetchComments(todoId) as TodoComment[]
    set({ comments, loading: false })
    // Sync actual count — fixes existing todos that predate the commentCount field
    const actual = comments.length
    const stored = useTodoStore.getState().todos.find(t => t.id === todoId)?.commentCount ?? 0
    if (stored !== actual) {
      useTodoStore.getState().setCommentCount(todoId, actual)
      await setCommentCount(todoId, actual)
    }
  },

  add: async (text: string) => {
    const todoId = get().todoId
    if (!todoId) return
    const user = auth.currentUser
    const authorName = user?.displayName || user?.email || 'Anonymous'
    const payload = { text, authorName, createdAt: Date.now() }
    const id = await addComment(todoId, payload)
    set(state => ({ comments: [...state.comments, { id, ...payload }] }))
    await bumpCommentCount(todoId, 1)
    useTodoStore.getState().bumpCommentCount(todoId, 1)
  },

  remove: async (commentId: string) => {
    const todoId = get().todoId
    if (!todoId) return
    await deleteComment(todoId, commentId)
    set(state => ({ comments: state.comments.filter(c => c.id !== commentId) }))
    await bumpCommentCount(todoId, -1)
    useTodoStore.getState().bumpCommentCount(todoId, -1)
  },
}))
