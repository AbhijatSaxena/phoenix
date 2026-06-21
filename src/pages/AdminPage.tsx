import { useCallback, useEffect, useState } from 'react'
import {
  Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  IconButton, Tooltip, Chip, CircularProgress, Paper,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import RefreshIcon from '@mui/icons-material/Refresh'
import { fetchAllSessions, revokeSession } from '../services/firebase'
import type { Session } from '../services/firebase'
import { useAuthStore } from '../store/authStore'

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

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const currentSessionId = useAuthStore(s => s.sessionId)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions(await fetchAllSessions()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16 }}>Administration</Typography>
          <Typography variant="caption" color="text.secondary">Active sessions across all devices</Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={load} size="small" disabled={loading}>
            {loading ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Paper variant="outlined" sx={{ bgcolor: '#111827', border: '1px solid #1f2937', borderRadius: 2, overflow: 'hidden' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: '#0f172a', borderColor: '#1f2937', fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' } }}>
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
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.disabled', borderColor: '#1f2937' }}>
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
                    '& td': { borderColor: '#1f2937', fontSize: 12, py: 1.25 },
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

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5, fontSize: 10 }}>
        Sessions are marked Active if last heartbeat was within 10 minutes. Heartbeat updates every 5 minutes while the app is open.
      </Typography>
    </Box>
  )
}
