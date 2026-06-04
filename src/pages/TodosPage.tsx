import { useCallback, useEffect, useState } from 'react'
import {
  Box, CircularProgress, Button, Dialog, DialogTitle, DialogContent,
  List, ListItem, ListItemText, IconButton, Typography, Chip,
} from '@mui/material'
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined'
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined'
import { useTodoStore } from '../store/todoStore'
import type { Todo } from '../types'
import TodoGraph from '../components/TodoGraph'
import TodoDetailPanel from '../components/TodoDetailPanel'
import { useIsReadOnly } from '../store/authStore'

export default function TodosPage() {
  const { todos, archivedTodos, loading, loadingArchived, load, loadArchived, update, unarchive } = useTodoStore()
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const isReadOnly = useIsReadOnly()

  useEffect(() => { load() }, [])

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

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
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

      <TodoGraph todos={todos} onSelect={handleSelect} />

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
                    <IconButton size="small" onClick={() => unarchive(t.id)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                      <UnarchiveOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
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
    </Box>
  )
}
