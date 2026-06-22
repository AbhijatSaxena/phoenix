import type { Todo } from '../types'

/**
 * Returns dep IDs that are genuinely pending (not done).
 * Works whether `allTodos` includes done todos or not — deps absent from
 * the array are treated as already done (they were filtered out).
 */
export function getPendingBlockers(todo: Todo, allTodos: Todo[]): string[] {
  return (todo.dependsOn ?? []).filter(id => {
    const dep = allTodos.find(t => t.id === id)
    return dep !== undefined && !dep.done
  })
}

export function isTodoBlocked(todo: Todo, allTodos: Todo[]): boolean {
  return getPendingBlockers(todo, allTodos).length > 0
}
