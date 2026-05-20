import { useEffect, useRef, useState } from 'react'
import { useCommentStore } from '../store/commentStore'
import { useIsReadOnly } from '../store/authStore'
import type { Todo } from '../types'
import Spinner from './Spinner'

interface Props {
  todo: Todo
  onClose: () => void
}

export default function TodoCommentPanel({ todo, onClose }: Props) {
  const { comments, loading, load, add, remove } = useCommentStore()
  const isReadOnly = useIsReadOnly()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load(todo.id) }, [todo.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  async function handleAdd() {
    const trimmed = text.trim()
    if (!trimmed) return
    await add(trimmed)
    setText('')
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-gray-700 gap-3">
          <div className="min-w-0">
            <p className="label mb-1">Comments</p>
            <p className={`text-sm font-medium truncate ${todo.done ? 'line-through text-gray-500' : 'text-white'}`}>
              {todo.text}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none shrink-0 mt-0.5">
            ✕
          </button>
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center pt-8"><Spinner /></div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-gray-600 text-center pt-8">No comments yet.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="group bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-blue-400 font-medium">{c.authorName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                    {!isReadOnly && (
                      <button
                        onClick={() => remove(c.id)}
                        className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs transition-opacity"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{c.text}</p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Add comment */}
        {!isReadOnly && (
          <div className="p-4 border-t border-gray-700">
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
              placeholder="Add a comment… (Enter to submit)"
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAdd()
                }
              }}
            />
            <button onClick={handleAdd} className="mt-2 w-full btn-primary py-1.5 text-sm">
              Comment
            </button>
          </div>
        )}
      </div>
    </>
  )
}
