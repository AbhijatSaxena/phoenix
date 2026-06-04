import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTodoStore } from '../store/todoStore'
import type { Todo } from '../types'
import { useIsReadOnly } from '../store/authStore'
import Spinner from '../components/Spinner'
import TodoCommentPanel from '../components/TodoCommentPanel'
import TodoGraph from '../components/TodoGraph'
import DependencyPanel from '../components/DependencyPanel'

interface RowProps {
  todo: Todo
  onToggle: (todo: Todo) => void
  onEdit: (todo: Todo, text: string) => void
  onDelete: (id: string) => void
  onComment: (todo: Todo) => void
  onManageDeps: (todo: Todo) => void
  isReadOnly: boolean
  isBlocked: boolean
}

function SortableRow({ todo, onToggle, onEdit, onDelete, onComment, onManageDeps, isReadOnly, isBlocked }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id })

  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(todo.text)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    if (isReadOnly) return
    setEditVal(todo.text)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitEdit() {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== todo.text) onEdit(todo, trimmed)
    setEditing(false)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hasDeps = (todo.dependsOn ?? []).length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-800/60 group"
    >
      {/* Drag handle / blocked indicator */}
      {!isReadOnly && (
        isBlocked
          ? <span className="text-red-900 shrink-0 text-sm" title="Blocked by dependencies">🔒</span>
          : <button
              {...attributes}
              {...listeners}
              className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0"
              tabIndex={-1}
            >⠿</button>
      )}

      {/* Checkbox */}
      <button
        onClick={() => !isBlocked && onToggle(todo)}
        title={isBlocked ? 'Complete dependencies first' : undefined}
        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors
          ${todo.done    ? 'bg-blue-600 border-blue-600 text-white'           : ''}
          ${isBlocked    ? 'border-gray-700 cursor-not-allowed opacity-40'    : ''}
          ${!todo.done && !isBlocked ? 'border-gray-600 hover:border-gray-400' : ''}`}
      >
        {todo.done && <span className="text-[10px] leading-none">✓</span>}
      </button>

      {/* Text */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 bg-blue-900/40 border border-blue-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
        />
      ) : (
        <span
          onDoubleClick={startEdit}
          className={`flex-1 text-sm select-none
            ${todo.done    ? 'line-through text-gray-600'                      : ''}
            ${isBlocked    ? 'text-gray-500'                                   : ''}
            ${!todo.done && !isBlocked ? 'text-gray-200'                       : ''}
            ${!isReadOnly  ? 'cursor-text'                                     : ''}`}
        >
          {todo.text}
        </span>
      )}

      {/* Dependency link icon — always visible if has deps, hover-only otherwise */}
      <button
        onClick={() => onManageDeps(todo)}
        title="Manage dependencies"
        className={`flex items-center gap-1 transition-opacity shrink-0
          ${hasDeps
            ? 'text-purple-400 opacity-100'
            : 'text-gray-700 hover:text-purple-400 opacity-0 group-hover:opacity-100'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        {hasDeps && <span className="text-[10px] font-medium">{(todo.dependsOn ?? []).length}</span>}
      </button>

      {/* Comment icon */}
      <button
        onClick={() => onComment(todo)}
        title="Comments"
        className={`flex items-center gap-1 transition-opacity shrink-0
          ${(todo.commentCount ?? 0) > 0
            ? 'text-blue-400 opacity-100'
            : 'text-gray-700 hover:text-blue-400 opacity-0 group-hover:opacity-100'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {(todo.commentCount ?? 0) > 0 && (
          <span className="text-[10px] leading-none font-medium">{todo.commentCount}</span>
        )}
      </button>

      {/* Delete */}
      {!isReadOnly && (
        <button
          onClick={() => onDelete(todo.id)}
          className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
        >✕</button>
      )}
    </div>
  )
}

export default function TodosPage() {
  const { todos, loading, load, add, update, remove, reorder } = useTodoStore()
  const isReadOnly = useIsReadOnly()
  const [newText, setNewText] = useState('')
  const [view, setView] = useState<'list' | 'graph'>('graph')
  const [commentTodo, setCommentTodo] = useState<Todo | null>(null)
  const [depsTodo, setDepsTodo] = useState<Todo | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  function isBlocked(todo: Todo): boolean {
    return (todo.dependsOn ?? []).some(id => !todos.find(t => t.id === id)?.done)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = todos.findIndex(t => t.id === active.id)
    const newIndex = todos.findIndex(t => t.id === over.id)
    reorder(arrayMove(todos, oldIndex, newIndex))
  }

  async function handleAdd() {
    const text = newText.trim()
    if (!text) return
    await add(text)
    setNewText('')
    inputRef.current?.focus()
  }

  async function handleToggle(todo: Todo) {
    if (isBlocked(todo) && !todo.done) return
    await update({ ...todo, done: !todo.done })
  }

  async function handleDepsChange(todo: Todo, deps: string[]) {
    const updated = { ...todo, dependsOn: deps }
    await update(updated)
    setDepsTodo(updated)
  }

  const handleComment = useCallback((todo: Todo) => setCommentTodo(todo), [])
  const handleManageDeps = useCallback((todo: Todo) => setDepsTodo(todo), [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>

  const pending = todos.filter(t => !t.done)
  const done    = todos.filter(t => t.done)

  return (
    <div className={`space-y-4 ${view === 'list' ? 'max-w-2xl' : 'w-full'}`}>
      {commentTodo && (
        <TodoCommentPanel todo={commentTodo} onClose={() => setCommentTodo(null)} />
      )}
      {depsTodo && (
        <DependencyPanel
          todo={depsTodo}
          todos={todos}
          onClose={() => setDepsTodo(null)}
          onChange={handleDepsChange}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Todos</h1>
        <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${view === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            List
          </button>
          <button
            onClick={() => setView('graph')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${view === 'graph' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Graph
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <>
          {/* Add input */}
          {!isReadOnly && (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                className="input flex-1"
                placeholder="Add a new todo…"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button onClick={handleAdd} className="btn-primary px-4">Add</button>
            </div>
          )}

          {/* Pending */}
          <div className="card p-2">
            {pending.length === 0 ? (
              <p className="text-sm text-gray-600 py-2 px-3">No pending todos.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={pending.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {pending.map(todo => (
                    <SortableRow
                      key={todo.id}
                      todo={todo}
                      isReadOnly={isReadOnly}
                      isBlocked={isBlocked(todo)}
                      onToggle={handleToggle}
                      onEdit={(t, text) => update({ ...t, text })}
                      onDelete={remove}
                      onComment={handleComment}
                      onManageDeps={handleManageDeps}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Done */}
          {done.length > 0 && (
            <div>
              <p className="label mb-2 px-1">Completed ({done.length})</p>
              <div className="card p-2 opacity-60">
                {done.map(todo => (
                  <SortableRow
                    key={todo.id}
                    todo={todo}
                    isReadOnly={isReadOnly}
                    isBlocked={false}
                    onToggle={handleToggle}
                    onEdit={(t, text) => update({ ...t, text })}
                    onDelete={remove}
                    onComment={handleComment}
                    onManageDeps={handleManageDeps}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <TodoGraph
          todos={todos}
          onToggle={handleToggle}
          onComment={handleComment}
          onManageDeps={handleManageDeps}
        />
      )}
    </div>
  )
}
