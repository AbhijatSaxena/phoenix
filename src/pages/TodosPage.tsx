import { useCallback, useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import { useTodoStore } from '../store/todoStore'
import type { Todo } from '../types'
import TodoGraph from '../components/TodoGraph'
import TodoDetailPanel from '../components/TodoDetailPanel'

export default function TodosPage() {
  const { todos, loading, load, update } = useTodoStore()
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)

  useEffect(() => { load() }, [])

  async function handleDepsChange(todo: Todo, deps: string[]) {
    const updated = { ...todo, dependsOn: deps }
    await update(updated)
    setSelectedTodo(updated)
  }

  const handleSelect = useCallback((todo: Todo) => setSelectedTodo(todo), [])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
        <CircularProgress size={32} />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      {selectedTodo && (
        <TodoDetailPanel
          todo={todos.find(t => t.id === selectedTodo.id) ?? selectedTodo}
          todos={todos}
          onClose={() => setSelectedTodo(null)}
          onDepsChange={handleDepsChange}
        />
      )}

      <TodoGraph todos={todos} onSelect={handleSelect} />
    </Box>
  )
}
