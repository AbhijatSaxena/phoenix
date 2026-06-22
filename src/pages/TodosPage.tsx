import { useCallback, useEffect, useState } from 'react'
import {
  Box, CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  List, ListItem, ListItemText, IconButton, Typography, Chip, Tooltip,
  TextField, InputAdornment,
} from '@mui/material'
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined'
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import { useTodoStore } from '../store/todoStore'
import type { Todo } from '../types'
import type { TodoAction } from '../services/ai'
import TodoGraph from '../components/TodoGraph'
import TodoDetailPanel from '../components/TodoDetailPanel'
import TodoAiChat from '../components/TodoAiChat'
import { useIsReadOnly } from '../store/authStore'

export default function TodosPage() {
  const { todos, archivedTodos, loading, loadingArchived, load, loadArchived, add, update, unarchive, archive, remove } = useTodoStore()
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const isReadOnly = useIsReadOnly()

  async function handleAddTodo() {
    const text = newText.trim()
    if (!text) return
    setAdding(true)
    await add(text)
    setNewText('')
    setAdding(false)
  }

  async function executeAiActions(actions: TodoAction[]) {
    // Track newly created todos by tempId so link_dep can reference them
    const tempMap: Record<string, Todo> = {}

    for (const action of actions) {
      if (action.type === 'create_todo' && action.text) {
        const todo = await add(action.text)
        if (action.tempId) tempMap[action.tempId] = todo

      } else if (action.type === 'link_dep' && action.todoId && action.dependsOnId) {
        const resolvedTodoId = tempMap[action.todoId]?.id ?? action.todoId
        const resolvedDepId  = tempMap[action.dependsOnId]?.id ?? action.dependsOnId
        const todo = tempMap[action.todoId] ?? todos.find(t => t.id === resolvedTodoId)
        if (todo) {
          const updated = { ...todo, dependsOn: [...new Set([...(todo.dependsOn ?? []), resolvedDepId])] }
          await update(updated)
          if (action.todoId in tempMap) tempMap[action.todoId] = updated
        }

      } else if (action.type === 'mark_done' && action.id) {
        const todo = todos.find(t => t.id === action.id)
        if (todo) await update({ ...todo, done: true })

      } else if (action.type === 'mark_undone' && action.id) {
        const todo = todos.find(t => t.id === action.id)
        if (todo) await update({ ...todo, done: false })

      } else if (action.type === 'archive' && action.id) {
        await archive(action.id)
      }
    }
  }

  useEffect(() => { load() }, [])

  const completedHidden = todos.filter(t => t.done)
  const graphTodos = todos.filter(t => !t.done)

  async function handleDepsChange(todo: Todo, deps: string[]) {
    const updated = { ...todo, dependsOn: deps }
    await update(updated)
    setSelectedTodo(updated)
  }

  const handleSelect = useCallback((todo: Todo) => setSelectedTodo(todo), [])

  function openArchived() {
    setShowArchived(true)
    loadArchived()
  }

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

      {!isReadOnly && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="New todo… (press Enter)"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
            disabled={adding}
            slotProps={{
              input: {
                endAdornment: newText.trim() ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={handleAddTodo} disabled={adding} edge="end">
                      {adding ? <CircularProgress size={16} /> : <AddIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1.5 }}>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<CheckCircleOutlinedIcon sx={{ fontSize: 14 }} />}
          onClick={() => setShowCompleted(true)}
          sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary', borderColor: '#374151' }}
        >
          Completed{completedHidden.length > 0 ? ` (${completedHidden.length})` : ''}
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<InventoryOutlinedIcon sx={{ fontSize: 14 }} />}
          onClick={openArchived}
          sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary', borderColor: '#374151' }}
        >
          Archived{archivedTodos.length > 0 ? ` (${archivedTodos.length})` : ''}
        </Button>
      </Box>

      <TodoGraph todos={graphTodos} onSelect={handleSelect} />

      {/* Completed todos dialog */}
      <Dialog open={showCompleted} onClose={() => setShowCompleted(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Completed Todos</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {completedHidden.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
              No completed todos.
            </Typography>
          )}
          <List disablePadding>
            {completedHidden.map(t => (
              <ListItem
                key={t.id}
                divider
                secondaryAction={
                  !isReadOnly && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Mark as not done">
                        <IconButton size="small" onClick={() => update({ ...t, done: false })} sx={{ color: 'text.secondary', '&:hover': { color: 'success.main' } }}>
                          <CheckCircleOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Archive">
                        <IconButton size="small" onClick={() => archive(t.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'warning.main' } }}>
                          <InventoryOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete permanently">
                        <IconButton size="small" onClick={() => remove(t.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }
              >
                <ListItemText
                  primary={t.text}
                  slotProps={{
                    primary: { style: { fontSize: 13, textDecoration: 'line-through', color: '#6b7280' } },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      {/* Archived todos dialog */}
      <Dialog open={showArchived} onClose={() => setShowArchived(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Archived Todos
          {loadingArchived && <CircularProgress size={16} />}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {!loadingArchived && archivedTodos.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
              No archived todos.
            </Typography>
          )}
          <List disablePadding>
            {archivedTodos.map(t => (
              <ListItem
                key={t.id}
                divider
                secondaryAction={
                  !isReadOnly && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Unarchive">
                        <IconButton size="small" onClick={() => unarchive(t.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                          <UnarchiveOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete permanently">
                        <IconButton size="small" onClick={() => remove(t.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }
              >
                <ListItemText
                  primary={t.text}
                  secondary={t.done ? 'Completed' : 'Incomplete'}
                  slotProps={{
                    primary: { style: { fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#6b7280' : undefined } },
                    secondary: { style: { fontSize: 11 } },
                  }}
                />
                {t.done && <Chip label="Done" size="small" color="success" sx={{ height: 16, fontSize: 9, mr: 1 }} />}
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>

      <TodoAiChat todos={todos} onExecute={executeAiActions} />
    </Box>
  )
}
