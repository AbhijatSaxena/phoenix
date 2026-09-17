import { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, Tooltip, Chip, CircularProgress, Paper, Divider,
  TextField, Button,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { fetchAllSessions, revokeSession, deleteRevokedSessions, fetchPaymentModes, savePaymentModes, fetchSyncStatus, runSyncNow } from '../services/firebase'
import type { Session } from '../services/firebase'
import { confirm } from '../components/ConfirmDialog'
import { useAuthStore } from '../store/authStore'
import { useLinksStore } from '../store/linksStore'
import { useRatesStore } from '../store/ratesStore'
import { statusHealthy } from '../lib/sync'
import type { QuickLink, SyncStatus } from '../types'

function parseUA(ua: string): string {
  if (/iPhone|iPad/.test(ua)) return '📱 iOS'
  if (/Android/.test(ua)) return '📱 Android'
  if (/Windows/.test(ua)) return '🖥 Windows'
  if (/Mac/.test(ua)) return '🖥 Mac'
  if (/Linux/.test(ua)) return '🖥 Linux'
  return '🌐 Browser'
}

function formatTime(ts: { seconds: number } | null): string {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })
}

function isActive(ts: { seconds: number } | null): boolean {
  if (!ts) return false
  return Date.now() - ts.seconds * 1000 < 10 * 60 * 1000
}

const EMPTY_FORM = { title: '', url: '', emoji: '🔗' }

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const currentSessionId = useAuthStore(s => s.sessionId)

  const { links, load: loadLinks, add: addLink, update: updateLink, remove: removeLink } = useLinksStore()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null)
  const [savingLink, setSavingLink] = useState(false)

  const [payModes, setPayModes] = useState<string[]>([])
  const [newMode, setNewMode] = useState('')
  const [savingMode, setSavingMode] = useState(false)

  const [syncStatus, setSyncStatus] = useState<Record<string, SyncStatus>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const loadRates = useRatesStore(s => s.loadRates)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try { setSessions(await fetchAllSessions()) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadSessions(); loadLinks()
    fetchPaymentModes().then(setPayModes)
    fetchSyncStatus().then(setSyncStatus).catch(() => {})
  }, [loadSessions])

  async function handleSyncNow() {
    setSyncing(true)
    setSyncError(null)
    try {
      setSyncStatus(await runSyncNow())
      // FX may have just changed — refresh the in-memory rates the app is using.
      loadRates()
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddMode() {
    const m = newMode.trim()
    if (!m || payModes.includes(m)) return
    setSavingMode(true)
    const updated = [...payModes, m]
    await savePaymentModes(updated)
    setPayModes(updated)
    setNewMode('')
    setSavingMode(false)
  }

  async function handleRemoveMode(m: string) {
    const ok = await confirm({ title: 'Remove payment mode', message: `Remove "${m}" from payment modes?` })
    if (!ok) return
    const updated = payModes.filter(x => x !== m)
    await savePaymentModes(updated)
    setPayModes(updated)
  }

  async function handleClearRevoked() {
    const revokedCount = sessions.filter(s => s.revoked).length
    if (revokedCount === 0) return
    const ok = await confirm({ title: 'Clear revoked sessions', message: `Permanently delete ${revokedCount} revoked session${revokedCount > 1 ? 's' : ''}?` })
    if (!ok) return
    setClearing(true)
    try {
      await deleteRevokedSessions()
      setSessions(prev => prev.filter(s => !s.revoked))
    } finally {
      setClearing(false)
    }
  }

  async function handleRevoke(session: Session) {
    if (session.id === currentSessionId) return
    setRevoking(session.id)
    try {
      await revokeSession(session.id)
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, revoked: true } : s))
    } finally {
      setRevoking(null)
    }
  }

  async function handleSaveLink() {
    const title = form.title.trim()
    const url   = form.url.trim()
    if (!title || !url) return
    setSavingLink(true)
    try {
      if (editingLink) {
        await updateLink({ ...editingLink, title, url, emoji: form.emoji })
      } else {
        await addLink(title, url, form.emoji)
      }
      setForm(EMPTY_FORM)
      setEditingLink(null)
    } finally {
      setSavingLink(false)
    }
  }

  function startEdit(link: QuickLink) {
    setEditingLink(link)
    setForm({ title: link.title, url: link.url, emoji: link.emoji })
  }

  function cancelEdit() {
    setEditingLink(null)
    setForm(EMPTY_FORM)
  }

  return (
    <Box>
      {/* Sessions header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16 }}>Administration</Typography>
          <Typography variant="caption" color="text.secondary">Active sessions across all devices</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {sessions.some(s => s.revoked) && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={handleClearRevoked}
              disabled={clearing}
              startIcon={clearing ? <CircularProgress size={12} color="inherit" /> : <DeleteOutlineIcon sx={{ fontSize: 14 }} />}
              sx={{ fontSize: 11, py: 0.5 }}
            >
              Clear revoked
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={loadSessions} size="small" disabled={loading}>
              {loading ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ bgcolor: 'background.paper', border: '1px solid var(--border-main)', borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: 'var(--surface-card)', borderColor: 'var(--border-main)', fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
              <TableCell>User</TableCell>
              <TableCell>Device</TableCell>
              <TableCell>Signed in (IST)</TableCell>
              <TableCell>Last seen (IST)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.disabled', borderColor: 'var(--border-main)' }}>
                  No sessions found.
                </TableCell>
              </TableRow>
            )}
            {sessions.map(s => {
              const isCurrent = s.id === currentSessionId
              const active = isActive(s.lastSeen as any)
              return (
                <TableRow
                  key={s.id}
                  sx={{
                    bgcolor: isCurrent ? 'rgba(37,99,235,0.08)' : 'transparent',
                    '& td': { borderColor: 'var(--border-main)', fontSize: 12, py: 1.25 },
                    opacity: s.revoked ? 0.4 : 1,
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400 }}>
                      {s.email}
                    </Typography>
                    {isCurrent && (
                      <Typography variant="caption" sx={{ color: 'primary.main', fontSize: 10 }}>This session</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{parseUA(s.userAgent)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{formatTime(s.signedInAt as any)}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{formatTime(s.lastSeen as any)}</TableCell>
                  <TableCell>
                    {s.revoked ? (
                      <Chip label="Revoked" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
                    ) : active ? (
                      <Chip label="Active" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                    ) : (
                      <Chip label="Idle" size="small" color="default" sx={{ height: 18, fontSize: 10 }} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {!s.revoked && !isCurrent && (
                      <Tooltip title="Force logout">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleRevoke(s)}
                            disabled={revoking === s.id}
                            sx={{ color: 'error.main', opacity: 0.7, '&:hover': { opacity: 1 } }}
                          >
                            {revoking === s.id
                              ? <CircularProgress size={14} />
                              : <LogoutIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, mb: 4, fontSize: 10 }}>
        Sessions are marked Active if last heartbeat was within 10 minutes. Heartbeat updates every 5 minutes while the app is open.
      </Typography>

      {/* Sync worker status */}
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, mb: 0.5 }}>Sync</Typography>
          <Typography variant="caption" color="text.secondary">
            Checkers run every 4 hours. Balances land on accounts with a sync source; FX rates go to the rate cache.
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={handleSyncNow}
          disabled={syncing}
          startIcon={syncing ? <CircularProgress size={12} color="inherit" /> : <PlayArrowIcon sx={{ fontSize: 14 }} />}
          sx={{ fontSize: 11, py: 0.5, whiteSpace: 'nowrap' }}
        >
          Run now
        </Button>
      </Box>
      {syncError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1.5 }}>{syncError}</Typography>
      )}
      <Paper variant="outlined" sx={{ bgcolor: 'background.paper', border: '1px solid var(--border-main)', borderRadius: 2, overflow: 'hidden', mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: 'var(--surface-card)', borderColor: 'var(--border-main)', fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
              <TableCell>Checker</TableCell>
              <TableCell>Last run (IST)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Took</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(syncStatus).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'center', py: 3, color: 'text.disabled', borderColor: 'var(--border-main)' }}>
                  No runs recorded yet.
                </TableCell>
              </TableRow>
            )}
            {Object.entries(syncStatus).map(([id, s]) => (
              <TableRow key={id} sx={{ '& td': { borderColor: 'var(--border-main)', fontSize: 12, py: 1.25 } }}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 500 }}>{s.label}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>{id}</Typography>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {new Date(s.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                </TableCell>
                <TableCell>
                  {!s.ok ? (
                    <Tooltip title={s.error ?? ''}>
                      <Chip label="Failed" size="small" color="error" sx={{ height: 18, fontSize: 10 }} />
                    </Tooltip>
                  ) : statusHealthy(s) ? (
                    <Chip label="OK" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                  ) : (
                    <Chip label="Stale" size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
                  )}
                  {!s.ok && s.error && (
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontSize: 10, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.error}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>{s.durationMs} ms</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Quick Links manager */}
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, mb: 0.5 }}>Quick Links</Typography>
        <Typography variant="caption" color="text.secondary">Links shown as a shortcut bar on the dashboard.</Typography>
      </Box>

      {/* Add / Edit form */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, alignItems: 'flex-start' }}>
        <TextField
          size="small"
          placeholder="Emoji"
          value={form.emoji}
          onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
          sx={{ width: 72 }}
          slotProps={{ htmlInput: { style: { textAlign: 'center', fontSize: 18 } } }}
        />
        <TextField
          size="small"
          placeholder="Title"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          placeholder="https://…"
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          sx={{ flex: 2 }}
          onKeyDown={e => e.key === 'Enter' && handleSaveLink()}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleSaveLink}
          disabled={savingLink || !form.title.trim() || !form.url.trim()}
          startIcon={editingLink ? <CheckIcon sx={{ fontSize: 14 }} /> : <AddIcon sx={{ fontSize: 14 }} />}
          sx={{ whiteSpace: 'nowrap', minWidth: 0 }}
        >
          {editingLink ? 'Save' : 'Add'}
        </Button>
        {editingLink && (
          <IconButton size="small" onClick={cancelEdit} sx={{ color: 'text.secondary' }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      {/* Links list */}
      {links.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 2, textAlign: 'center' }}>No links yet.</Typography>
      ) : (
        <Paper variant="outlined" sx={{ border: '1px solid var(--border-main)', borderRadius: 2, overflow: 'hidden' }}>
          {links.map((link, i) => (
            <Box
              key={link.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.25,
                borderBottom: i < links.length - 1 ? '1px solid var(--border-main)' : 'none',
                bgcolor: editingLink?.id === link.id ? 'rgba(37,99,235,0.06)' : 'transparent',
              }}
            >
              <Typography sx={{ fontSize: 18, lineHeight: 1, width: 24, textAlign: 'center' }}>{link.emoji}</Typography>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500 }}>{link.title}</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {link.url}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => startEdit(link)} sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' }, p: 0.5 }}>
                  <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton size="small" onClick={() => removeLink(link.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, p: 0.5 }}>
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {/* Payment Modes */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16, mb: 0.5 }}>Payment Modes</Typography>
        <Typography variant="caption" color="text.secondary">Modes available in Property payment dropdowns.</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder="e.g. Savings Account"
          value={newMode}
          onChange={e => setNewMode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddMode()}
          sx={{ flex: 1 }}
        />
        <Button variant="contained" size="small" onClick={handleAddMode}
          disabled={savingMode || !newMode.trim() || payModes.includes(newMode.trim())}
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}>
          Add
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {payModes.map(m => (
          <Chip
            key={m}
            label={m}
            size="small"
            variant="outlined"
            onDelete={() => handleRemoveMode(m)}
            sx={{ borderColor: 'var(--border-subtle)', color: 'text.secondary', '& .MuiChip-deleteIcon': { color: 'text.disabled', '&:hover': { color: 'error.main' } } }}
          />
        ))}
        {payModes.length === 0 && (
          <Typography variant="body2" color="text.disabled">No modes yet.</Typography>
        )}
      </Box>

    </Box>
  )
}
