import type { Todo } from '../types'

interface Props {
  todo: Todo
  todos: Todo[]
  onClose: () => void
  onChange: (todo: Todo, deps: string[]) => void
}

function wouldCreateCycle(todos: Todo[], targetId: string, newDepId: string): boolean {
  const visited = new Set<string>()
  function reaches(id: string): boolean {
    if (id === targetId) return true
    if (visited.has(id)) return false
    visited.add(id)
    const t = todos.find(t => t.id === id)
    return (t?.dependsOn ?? []).some(reaches)
  }
  return reaches(newDepId)
}

export default function DependencyPanel({ todo, todos, onClose, onChange }: Props) {
  const others = todos.filter(t => t.id !== todo.id)
  const selected = new Set(todo.dependsOn ?? [])

  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) {
      next.delete(id)
    } else {
      if (wouldCreateCycle(todos, todo.id, id)) return
      next.add(id)
    }
    onChange(todo, Array.from(next))
  }

  const blockedByThis = todos.filter(t => (t.dependsOn ?? []).includes(todo.id))

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-700 z-50 flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-4 border-b border-gray-700 gap-3">
          <div className="min-w-0">
            <p className="label mb-1">Dependencies</p>
            <p className={`text-sm font-medium truncate ${todo.done ? 'line-through text-gray-500' : 'text-white'}`}>
              {todo.text}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none shrink-0 mt-0.5">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Blocked by */}
          <div>
            <p className="label mb-2">Blocked by (must finish first)</p>
            <p className="text-xs text-gray-600 mb-3">Check todos that must be completed before this one can be marked done.</p>
            {others.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">No other todos.</p>
            ) : (
              <div className="space-y-1">
                {others.map(t => {
                  const isChecked = selected.has(t.id)
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
                        disabled={isCyclic}
                        onChange={() => toggle(t.id)}
                        className="w-4 h-4 accent-blue-500 shrink-0"
                      />
                      <span className={`text-sm flex-1 leading-snug ${t.done ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                        {t.text}
                      </span>
                      {t.done && <span className="text-[10px] text-green-600 shrink-0">Done</span>}
                      {isCyclic && <span className="text-[10px] text-red-700 shrink-0">Cycle</span>}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Blocks */}
          {blockedByThis.length > 0 && (
            <div>
              <p className="label mb-2">Blocks (waiting on this)</p>
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
      </div>
    </>
  )
}
