import { useEffect, useRef, useState } from 'react'
import type { Todo } from '../types'
import { useCommentStore } from '../store/commentStore'
import { useTodoStore } from '../store/todoStore'
import { useIsReadOnly } from '../store/authStore'
import Spinner from './Spinner'

interface Props {
  todo: Todo
  todos: Todo[]
  onClose: () => void
  onDepsChange: (todo: Todo, deps: string[]) => void
}

type Tab = 'comments' | 'blockers'

function wouldCreateCycle(todos: Todo[], targetId: string, newDepId: string): boolean {
  const visited = new Set<string>()
  function reaches(id: string): boolean {
    if (id === targetId) return true
    if (visited.has(id)) return false
    visited.add(id)
    return (todos.find(t => t.id === id)?.dependsOn ?? []).some(reaches)
  }
  return reaches(newDepId)
}

export default function TodoDetailPanel({ todo, todos, onClose, onDepsChange }: Props) {
  const [tab, setTab] = useState<Tab>('comments')
  const [commentText, setCommentText] = useState('')
  const [newBlockerText, setNewBlockerText] = useState('')
  const { comments, loading: commentsLoading, load, add: addComment, remove: removeComment } = useCommentStore()
  const { add: addTodo } = useTodoStore()
  const isReadOnly = useIsReadOnly()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load(todo.id) }, [todo.id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  async function handleAddComment() {
    const text = commentText.trim()
    if (!text) return
    await addComment(text)
    setCommentText('')
  }

  async function handleAddBlocker() {
    const text = newBlockerText.trim()
    if (!text) return
    const newTodo = await addTodo(text)
    onDepsChange(todo, [...(todo.dependsOn ?? []), newTodo.id])
    setNewBlockerText('')
  }

  function toggleDep(depId: string) {
    const current = new Set(todo.dependsOn ?? [])
    if (current.has(depId)) {
      current.delete(depId)
    } else {
      if (wouldCreateCycle(todos, todo.id, depId)) return
      current.add(depId)
    }
    onDepsChange(todo, Array.from(current))
  }

  const others = todos.filter(t => t.id !== todo.id)
  const blockedByThis = todos.filter(t => (t.dependsOn ?? []).includes(todo.id))
  const isBlocked = (todo.dependsOn ?? []).some(id => !todos.find(t => t.id === id)?.done)
  const statusLabel = todo.done ? '✓ Done' : isBlocked ? '🔒 Blocked' : '● Ready'
  const statusColor = todo.done ? 'text-gray-500' : isBlocked ? 'text-red-500' : 'text-blue-400'

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className={`label mb-1 ${statusColor}`}>{statusLabel}</p>
              <p className={`text-sm font-semibold leading-snug ${todo.done ? 'line-through text-gray-500' : 'text-white'}`}>
                {todo.text}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white text-lg shrink-0 mt-0.5">✕</button>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('comments')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors
                ${tab === 'comments' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Comments{comments.length > 0 ? ` (${comments.length})` : ''}
            </button>
            <button
              onClick={() => setTab('blockers')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors
                ${tab === 'blockers' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Blockers{(todo.dependsOn ?? []).length > 0 ? ` (${(todo.dependsOn ?? []).length})` : ''}
            </button>
          </div>
        </div>

        {/* Comments tab */}
        {tab === 'comments' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {commentsLoading ? (
                <div className="flex justify-center pt-8"><Spinner /></div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-600 text-center pt-8">No comments yet.</p>
              ) : comments.map(c => (
                <div key={c.id} className="group bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-400 font-medium">{c.authorName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</span>
                      {!isReadOnly && (
                        <button
                          onClick={() => removeComment(c.id)}
                          className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity"
                        >✕</button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {!isReadOnly && (
              <div className="p-4 border-t border-gray-700">
                <textarea
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
                  placeholder="Add a comment… (Enter to submit)"
                  rows={3}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                />
                <button onClick={handleAddComment} className="mt-2 w-full btn-primary py-1.5 text-sm">
                  Comment
                </button>
              </div>
            )}
          </>
        )}

        {/* Blockers tab */}
        {tab === 'blockers' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">

            {/* Create new blocker */}
            {!isReadOnly && (
              <div>
                <p className="label mb-2">Create new blocker</p>
                <p className="text-xs text-gray-600 mb-3">Adds a brand new todo and auto-links it as a dependency.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="input flex-1 text-sm"
                    placeholder="New blocker todo…"
                    value={newBlockerText}
                    onChange={e => setNewBlockerText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddBlocker()}
                  />
                  <button onClick={handleAddBlocker} className="btn-primary px-3 text-sm shrink-0">Add</button>
                </div>
              </div>
            )}

            {/* Link existing */}
            <div>
              <p className="label mb-2">Link existing todos</p>
              <p className="text-xs text-gray-600 mb-3">Checked todos must be completed before this one.</p>
              {others.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-4">No other todos.</p>
              ) : (
                <div className="space-y-1">
                  {others.map(t => {
                    const isChecked = (todo.dependsOn ?? []).includes(t.id)
                    const isCyclic = !isChecked && wouldCreateCycle(todos, todo.id, t.id)
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors
                          ${isCyclic ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-800 cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isCyclic || isReadOnly}
                          onChange={() => toggleDep(t.id)}
                          className="w-4 h-4 accent-blue-500 shrink-0"
                        />
                        <span className={`text-sm flex-1 leading-snug ${t.done ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                          {t.text}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {t.done && <span className="text-[10px] text-green-600">Done</span>}
                          {isCyclic && <span className="text-[10px] text-red-700">Cycle</span>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* This unblocks */}
            {blockedByThis.length > 0 && (
              <div>
                <p className="label mb-2">This unblocks</p>
                <div className="space-y-1">
                  {blockedByThis.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50">
                      <span className="text-xs text-purple-400">→</span>
                      <span className={`text-sm flex-1 ${t.done ? 'line-through text-gray-600' : 'text-gray-300'}`}>{t.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
