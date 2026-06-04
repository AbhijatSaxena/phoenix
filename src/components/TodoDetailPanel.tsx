import { useEffect, useRef, useState } from 'react'
import {
  Drawer, Box, Typography, IconButton, Tabs, Tab, TextField, Button,
  CircularProgress, Divider, Chip, Checkbox, Tooltip,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { Todo } from '../types'
import { useCommentStore } from '../store/commentStore'
import { useTodoStore } from '../store/todoStore'
import { useIsReadOnly } from '../store/authStore'

interface Props {
  todo: Todo
  todos: Todo[]
  onClose: () => void
  onDepsChange: (todo: Todo, deps: string[]) => void
}

type TabId = 0 | 1

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
  const [tab, setTab] = useState<TabId>(0)
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
  const statusColor = todo.done ? 'text.disabled' : isBlocked ? 'error.main' : 'primary.main'

  return (
    <Drawer
      anchor="right"
      open
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { width: { xs: '100%', sm: 400 }, bgcolor: '#111827', borderLeft: '1px solid #1f2937', display: 'flex', flexDirection: 'column' },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: '1px solid #1f2937' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: statusColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
              {statusLabel}
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{ mt: 0.25, color: todo.done ? 'text.disabled' : 'text.primary', textDecoration: todo.done ? 'line-through' : 'none', lineHeight: 1.4, wordBreak: 'break-word' }}
            >
              {todo.text}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, fontSize: 12, textTransform: 'none', py: 0.5 } }}
        >
          <Tab label={`Comments${comments.length > 0 ? ` (${comments.length})` : ''}`} />
          <Tab label={`Blockers${(todo.dependsOn ?? []).length > 0 ? ` (${(todo.dependsOn ?? []).length})` : ''}`} />
        </Tabs>
      </Box>

      {/* Comments tab */}
      {tab === 0 && (
        <>
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {commentsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}><CircularProgress size={24} /></Box>
            ) : comments.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', pt: 4 }}>
                No comments yet.
              </Typography>
            ) : comments.map(c => (
              <Box key={c.id} sx={{ bgcolor: '#0f172a', borderRadius: 2, p: 1.5, border: '1px solid #1f2937', '&:hover .delete-btn': { opacity: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'primary.light', fontWeight: 600 }}>{c.authorName}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.disabled">{new Date(c.createdAt).toLocaleDateString()}</Typography>
                    {!isReadOnly && (
                      <IconButton
                        className="delete-btn"
                        size="small"
                        onClick={() => removeComment(c.id)}
                        sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'error.main', p: 0.25 }}
                      >
                        <CloseIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap', fontSize: 13 }}>{c.text}</Typography>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Box>

          {!isReadOnly && (
            <Box sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
              <TextField
                multiline
                rows={3}
                fullWidth
                size="small"
                placeholder="Add a comment… (Enter to submit)"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                sx={{ mb: 1.5 }}
              />
              <Button variant="contained" fullWidth onClick={handleAddComment} size="small">Comment</Button>
            </Box>
          )}
        </>
      )}

      {/* Blockers tab */}
      {tab === 1 && (
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 3 }}>

          {!isReadOnly && (
            <Box>
              <Typography variant="overline" sx={{ fontSize: 10, display: 'block', mb: 0.5 }}>Create new blocker</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Adds a new todo and auto-links it as a dependency.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="New blocker todo…"
                  value={newBlockerText}
                  onChange={e => setNewBlockerText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddBlocker()}
                />
                <Button variant="contained" onClick={handleAddBlocker} size="small" sx={{ whiteSpace: 'nowrap' }}>Add</Button>
              </Box>
            </Box>
          )}

          <Box>
            <Typography variant="overline" sx={{ fontSize: 10, display: 'block', mb: 0.5 }}>Link existing todos</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Checked todos must be completed before this one.
            </Typography>
            {others.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>No other todos.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {others.map(t => {
                  const isChecked = (todo.dependsOn ?? []).includes(t.id)
                  const isCyclic = !isChecked && wouldCreateCycle(todos, todo.id, t.id)
                  return (
                    <Tooltip key={t.id} title={isCyclic ? 'Would create a cycle' : ''} placement="left">
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1,
                          borderRadius: 2,
                          opacity: isCyclic ? 0.3 : 1,
                          cursor: isCyclic ? 'not-allowed' : 'pointer',
                          '&:hover': isCyclic ? {} : { bgcolor: 'action.hover' },
                        }}
                        onClick={() => !isCyclic && !isReadOnly && toggleDep(t.id)}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isCyclic || isReadOnly}
                          size="small"
                          sx={{ p: 0 }}
                        />
                        <Typography
                          variant="body2"
                          sx={{ flex: 1, color: t.done ? 'text.disabled' : 'text.secondary', textDecoration: t.done ? 'line-through' : 'none', fontSize: 13 }}
                        >
                          {t.text}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {t.done && <Chip label="Done" size="small" color="success" sx={{ height: 16, fontSize: 9 }} />}
                          {isCyclic && <Chip label="Cycle" size="small" color="error" sx={{ height: 16, fontSize: 9 }} />}
                        </Box>
                      </Box>
                    </Tooltip>
                  )
                })}
              </Box>
            )}
          </Box>

          {blockedByThis.length > 0 && (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="overline" sx={{ fontSize: 10, display: 'block', mb: 1 }}>This unblocks</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {blockedByThis.map(t => (
                  <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" sx={{ color: '#a78bfa' }}>→</Typography>
                    <Typography variant="body2" sx={{ flex: 1, color: t.done ? 'text.disabled' : 'text.secondary', textDecoration: t.done ? 'line-through' : 'none', fontSize: 13 }}>
                      {t.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Drawer>
  )
}
