import { useEffect, useRef, useState } from 'react'
import {
  Drawer, Box, Typography, IconButton, Tabs, Tab, TextField, Button,
  CircularProgress, Divider, Checkbox,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AdjustOutlinedIcon from '@mui/icons-material/AdjustOutlined'
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined'
import type { Todo } from '../types'
import { getPendingBlockers, isTodoBlocked } from '../utils/todoUtils'
import { fmtElapsed, fmtMs } from '../hooks/useTodoFocus'
import { useCommentStore } from '../store/commentStore'
import { useTodoStore } from '../store/todoStore'
import { useIsReadOnly } from '../store/authStore'
import { confirm } from './ConfirmDialog'

interface Props {
  todo: Todo
  todos: Todo[]
  onClose: () => void
  onDepsChange: (todo: Todo, deps: string[]) => void
  focusedId: string | null
  paused: boolean
  elapsed: number
  onFocus: (id: string) => void
  onPause: () => void
  onResume: () => void
  onUnfocus: () => void
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

export default function TodoDetailPanel({ todo, todos, onClose, onDepsChange, focusedId, paused, elapsed, onFocus, onPause, onResume, onUnfocus }: Props) {
  const [tab, setTab] = useState<TabId>(0)
  const [commentText, setCommentText] = useState('')
  const [newBlockerText, setNewBlockerText] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const { comments, loading: commentsLoading, load, add: addComment, remove: removeComment } = useCommentStore()
  const { add: addTodo, update: updateTodo, archive: archiveTodo, remove: removeTodo } = useTodoStore()
  const isReadOnly = useIsReadOnly()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { load(todo.id) }, [todo.id])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  function startTitleEdit() {
    if (isReadOnly) return
    setTitleDraft(todo.text)
    setEditingTitle(true)
  }

  async function commitTitleEdit() {
    const text = titleDraft.trim()
    if (text && text !== todo.text) await updateTodo({ ...todo, text })
    setEditingTitle(false)
  }

  function handleTitleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitTitleEdit()
    if (e.key === 'Escape') setEditingTitle(false)
  }

  async function handleToggleDone() {
    await updateTodo({ ...todo, done: !todo.done })
  }

  async function handleArchive() {
    const ok = await confirm({ title: 'Archive todo', message: `Archive "${todo.text}"? It will be hidden but can be restored.`, confirmLabel: 'Archive', danger: false })
    if (!ok) return
    await archiveTodo(todo.id)
    onClose()
  }

  async function handleDelete() {
    const ok = await confirm({ title: 'Delete todo', message: `Permanently delete "${todo.text}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await removeTodo(todo.id)
    onClose()
  }

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

  const blockedByThis = todos.filter(t => (t.dependsOn ?? []).includes(todo.id))
  const activeDeps = (todo.dependsOn ?? [])
    .map(id => todos.find(t => t.id === id))
    .filter((t): t is Todo => t !== undefined && !t.done)
  const resolvedDeps = (todo.dependsOn ?? [])
    .map(id => todos.find(t => t.id === id))
    .filter((t): t is Todo => t !== undefined && t.done)
  const linkableTodos = todos.filter(t =>
    t.id !== todo.id &&
    !t.done &&
    !(todo.dependsOn ?? []).includes(t.id) &&
    !wouldCreateCycle(todos, todo.id, t.id)
  )
  const blocked = isTodoBlocked(todo, todos)
  const pendingBlockersCount = getPendingBlockers(todo, todos).length
  const isFocused = focusedId === todo.id
  const canFocus = !todo.done && !blocked
  const focusLabel = paused ? `⏸ ${fmtElapsed(elapsed)}` : `⏱ ${fmtElapsed(elapsed)}`
  const statusLabel = todo.done ? '✓ Done' : isFocused ? focusLabel : blocked ? '🔒 Blocked' : '● Ready'
  const statusColor = todo.done ? 'text.disabled' : isFocused ? '#d97706' : blocked ? 'error.main' : 'primary.main'

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
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="caption" sx={{ color: statusColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
                {statusLabel}
              </Typography>
              {(todo.focusMs ?? 0) > 0 && (
                <Typography variant="caption" sx={{ fontSize: 10, color: '#78716c', fontWeight: 500 }}>
                  ⏱ {fmtMs(todo.focusMs!)} invested
                </Typography>
              )}
            </Box>
            {!isReadOnly && editingTitle ? (
              <TextField
                size="small"
                fullWidth
                multiline
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={handleTitleKey}
                autoFocus
                sx={{ mt: 0.5, '& .MuiInputBase-root': { fontSize: 13 } }}
              />
            ) : (
              <Typography
                variant="subtitle2"
                onClick={startTitleEdit}
                sx={{
                  mt: 0.25,
                  color: todo.done ? 'text.disabled' : 'text.primary',
                  textDecoration: todo.done ? 'line-through' : 'none',
                  lineHeight: 1.4,
                  wordBreak: 'break-word',
                  cursor: isReadOnly ? 'default' : 'text',
                  borderRadius: 1,
                  '&:hover': isReadOnly ? {} : { bgcolor: 'action.hover', px: 0.5, mx: -0.5 },
                }}
              >
                {todo.text}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary', mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {!isReadOnly && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Button
              size="small"
              variant={todo.done ? 'outlined' : 'contained'}
              color={todo.done ? 'inherit' : 'success'}
              startIcon={<CheckCircleOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={handleToggleDone}
              sx={{ fontSize: 11, py: 0.5, textTransform: 'none', flex: 1 }}
            >
              {todo.done ? 'Unmark done' : 'Mark as done'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<InventoryOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={handleArchive}
              sx={{ fontSize: 11, py: 0.5, textTransform: 'none', flex: 1 }}
            >
              Archive
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
              onClick={handleDelete}
              sx={{ fontSize: 11, py: 0.5, textTransform: 'none', flex: 1 }}
            >
              Delete
            </Button>
          </Box>
        )}

        {canFocus && !isFocused && (
          <Button
            fullWidth size="small" variant="outlined"
            startIcon={<AdjustOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => onFocus(todo.id)}
            sx={{ mb: 1.5, fontSize: 11, py: 0.75, textTransform: 'none', fontWeight: 600,
              borderColor: '#92400e', color: '#d97706',
              '&:hover': { bgcolor: 'rgba(217,119,6,0.08)', borderColor: '#92400e' } }}
          >
            Focus on this
          </Button>
        )}

        {isFocused && (
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Button
              size="small" variant="outlined" fullWidth
              startIcon={paused
                ? <AdjustOutlinedIcon sx={{ fontSize: 14 }} />
                : <PauseCircleOutlinedIcon sx={{ fontSize: 14 }} />}
              onClick={paused ? onResume : onPause}
              sx={{ fontSize: 11, py: 0.75, textTransform: 'none', fontWeight: 600,
                borderColor: '#92400e', color: '#d97706',
                '&:hover': { bgcolor: 'rgba(217,119,6,0.08)', borderColor: '#92400e' } }}
            >
              {paused ? `Resume  ·  ${fmtElapsed(elapsed)}` : `Pause  ·  ${fmtElapsed(elapsed)}`}
            </Button>
            <Button
              size="small" variant="contained"
              onClick={onUnfocus}
              sx={{ fontSize: 11, py: 0.75, textTransform: 'none', fontWeight: 600, px: 2,
                bgcolor: '#7c3f3f', '&:hover': { bgcolor: '#991b1b' } }}
            >
              Stop
            </Button>
          </Box>
        )}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, fontSize: 12, textTransform: 'none', py: 0.5 } }}
        >
          <Tab label={`Comments${comments.length > 0 ? ` (${comments.length})` : ''}`} />
          <Tab label={`Blockers${pendingBlockersCount > 0 ? ` (${pendingBlockersCount})` : ''}`} />
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
        <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Active blockers */}
          <Box>
            <Typography variant="overline" sx={{ fontSize: 10, display: 'block', mb: 0.75 }}>Currently blocking</Typography>
            {activeDeps.length === 0 ? (
              <Typography variant="body2" sx={{ fontSize: 12, color: 'success.main', py: 0.5 }}>✓ Nothing is blocking this todo</Typography>
            ) : activeDeps.map(dep => (
              <Box key={dep.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 2, '&:hover': isReadOnly ? {} : { bgcolor: 'action.hover' } }}>
                <LockOutlinedIcon sx={{ fontSize: 13, color: '#a78bfa', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ flex: 1, fontSize: 13, color: 'text.secondary' }}>{dep.text}</Typography>
                {!isReadOnly && (
                  <IconButton size="small" onClick={() => toggleDep(dep.id)} sx={{ color: 'text.disabled', p: 0.25, '&:hover': { color: 'error.main' } }}>
                    <CloseIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>

          {/* Resolved deps */}
          {resolvedDeps.length > 0 && (
            <Box>
              <Typography variant="overline" sx={{ fontSize: 10, display: 'block', mb: 0.75, color: 'success.main' }}>Resolved</Typography>
              {resolvedDeps.map(dep => (
                <Box key={dep.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 2, opacity: 0.55 }}>
                  <CheckCircleOutlinedIcon sx={{ fontSize: 13, color: 'success.main', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1, fontSize: 13, color: 'text.disabled', textDecoration: 'line-through' }}>{dep.text}</Typography>
                  {!isReadOnly && (
                    <IconButton size="small" onClick={() => toggleDep(dep.id)} sx={{ color: 'text.disabled', p: 0.25, '&:hover': { color: 'text.secondary' } }}>
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Add blockers */}
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

          {/* Link existing */}
          {linkableTodos.length > 0 && (
            <Box>
              <Typography variant="overline" sx={{ fontSize: 10, display: 'block', mb: 0.5 }}>Link existing todo</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Must be completed before this one.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {linkableTodos.map(t => (
                  <Box
                    key={t.id}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, borderRadius: 2, cursor: isReadOnly ? 'default' : 'pointer', '&:hover': isReadOnly ? {} : { bgcolor: 'action.hover' } }}
                    onClick={() => !isReadOnly && toggleDep(t.id)}
                  >
                    <Checkbox checked={false} disabled={isReadOnly} size="small" sx={{ p: 0 }} />
                    <Typography variant="body2" sx={{ flex: 1, fontSize: 13, color: 'text.secondary' }}>{t.text}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* This unblocks */}
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
