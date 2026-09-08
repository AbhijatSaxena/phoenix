import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Button, TextField, CircularProgress, IconButton, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import { useHandoverStore } from '../store/handoverStore'
import { confirm } from '../components/ConfirmDialog'
import { useIsReadOnly } from '../store/authStore'

function timeAgo(ms?: number): string {
  if (!ms) return 'never'
  const diff  = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HandoverPage() {
  const { notes, loading, load, add, update, remove } = useHandoverStore()
  const isReadOnly = useIsReadOnly()

  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [draftTitle, setDraftTitle]     = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [saving, setSaving]             = useState(false)
  const [adding, setAdding]             = useState(false)

  useEffect(() => { load() }, [])

  const selected = notes.find(n => n.id === selectedId) ?? null
  const isDirty  = !!selected && (draftTitle !== selected.title || draftContent !== selected.content)

  function selectNote(id: string) {
    const note = notes.find(n => n.id === id)
    if (!note) return
    setSelectedId(id)
    setDraftTitle(note.title)
    setDraftContent(note.content)
  }

  async function handleAdd() {
    setAdding(true)
    const id = await add('Untitled')
    setAdding(false)
    setSelectedId(id)
    setDraftTitle('Untitled')
    setDraftContent('')
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    await update({ ...selected, title: draftTitle.trim() || 'Untitled', content: draftContent })
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected) return
    const ok = await confirm({
      title: 'Delete note',
      message: `Permanently delete "${selected.title}"? This cannot be undone.`,
    })
    if (!ok) return
    await remove(selected.id)
    setSelectedId(null)
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Handover</Typography>
          <Typography variant="caption" color="text.secondary">
            Everything a trusted person would need to know. Visible to anyone with access to this app.
          </Typography>
        </Box>
        {!isReadOnly && (
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAdd} disabled={adding}
            sx={{ flexShrink: 0, ml: 2 }}>
            New Note
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mt: 2.5 }}>

        {/* ── Note list ── */}
        <Paper
          elevation={0}
          sx={{
            width: { xs: '100%', md: 260 },
            flexShrink: 0,
            border: '1px solid var(--border-main)',
            overflow: 'hidden',
            display: { xs: selectedId ? 'none' : 'block', md: 'block' },
          }}
        >
          {notes.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <DescriptionOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.disabled">
                No notes yet.
              </Typography>
            </Box>
          ) : notes.map((note, i) => (
            <Box
              key={note.id}
              onClick={() => selectNote(note.id)}
              sx={{
                px: 2, py: 1.5,
                cursor: 'pointer',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-main)',
                bgcolor: note.id === selectedId ? 'action.selected' : 'transparent',
                borderLeft: '2px solid',
                borderLeftColor: note.id === selectedId ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Typography variant="body2" noWrap sx={{ fontWeight: note.id === selectedId ? 600 : 400 }}>
                {note.title || 'Untitled'}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                {timeAgo(note.updatedAt)}
              </Typography>
            </Box>
          ))}
        </Paper>

        {/* ── Editor / viewer ── */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minWidth: 0,
            width: { xs: '100%', md: 'auto' },
            border: '1px solid var(--border-main)',
            p: 2.5,
            display: { xs: selectedId ? 'block' : 'none', md: 'block' },
          }}
        >
          {!selected ? (
            <Typography variant="body2" color="text.disabled" sx={{ py: 6, textAlign: 'center' }}>
              Select a note to {isReadOnly ? 'read' : 'edit'}.
            </Typography>
          ) : (
            <>
              {/* Editor header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <IconButton
                  size="small"
                  onClick={() => setSelectedId(null)}
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.secondary' }}
                >
                  <ArrowBackIcon fontSize="small" />
                </IconButton>

                {isReadOnly ? (
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>{selected.title}</Typography>
                ) : (
                  <TextField
                    variant="standard"
                    placeholder="Note title"
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    sx={{ flex: 1 }}
                    slotProps={{ input: { disableUnderline: true, sx: { fontSize: 17, fontWeight: 700 } } }}
                  />
                )}

                {isDirty && <Chip label="Unsaved" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}

                {!isReadOnly && (
                  <>
                    <Button variant="contained" size="small" onClick={handleSave} disabled={!isDirty || saving} sx={{ flexShrink: 0 }}>
                      {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
                    </Button>
                    <IconButton size="small" onClick={handleDelete} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>

              {/* Body */}
              {isReadOnly ? (
                <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8, color: 'text.primary' }}>
                  {selected.content || <Box component="span" sx={{ color: 'text.disabled' }}>This note is empty.</Box>}
                </Typography>
              ) : (
                <TextField
                  multiline
                  minRows={16}
                  fullWidth
                  placeholder="Write anything here — account details, who to contact, where documents are kept, instructions…"
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave() }
                  }}
                  slotProps={{ input: { sx: { fontSize: 14, lineHeight: 1.8, alignItems: 'flex-start' } } }}
                />
              )}

              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, fontSize: 10 }}>
                Last updated {timeAgo(selected.updatedAt)}
                {!isReadOnly && ' · ⌘/Ctrl+S to save'}
              </Typography>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  )
}
