import { Fragment, useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Button, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Collapse,
} from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { confirm } from '../components/ConfirmDialog'
import { useSnapshotStore } from '../store/snapshotStore'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { fmtINR, fmtDiff, diffClass, isoToDisplay } from '../lib/fmt'
import { useIsReadOnly } from '../store/authStore'
import type { SnapshotAccount } from '../types'
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

export default function SnapshotsPage() {
  const { snapshots, loading, load, saveSnapshot, updateSnapshot, removeSnapshot } = useSnapshotStore()
  const accounts   = useDashboardStore(s => s.accounts)
  const rates      = useRatesStore(s => s.rates)
  const isReadOnly = useIsReadOnly()

  const [showModal, setShowModal]       = useState(false)
  const [note, setNote]                 = useState('')
  const [saving, setSaving]             = useState(false)
  const [editCell, setEditCell]         = useState<{ id: string } | null>(null)
  const [editValue, setEditValue]       = useState('')
  const [expandedRow, setExpandedRow]   = useState<string | null>(null)
  const [showLegacy, setShowLegacy]     = useState(false)

  function startNotesEdit(id: string, current: string) {
    setEditCell({ id })
    setEditValue(current)
  }

  async function commitNotesEdit() {
    if (!editCell) return
    const snap = snapshots.find(s => s.id === editCell.id)
    if (!snap) { setEditCell(null); return }
    await updateSnapshot({ ...snap, notes: editValue })
    setEditCell(null)
  }

  function handleCellKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitNotesEdit()
    if (e.key === 'Escape') setEditCell(null)
  }

  useEffect(() => { load() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const liquid       = accounts.filter(a => a.category === 'liquid').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const appreciating = accounts.filter(a => a.category === 'appreciating').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const investments  = accounts.filter(a => a.category === 'investments').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const depreciating = accounts.filter(a => a.category === 'depreciating').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  async function handleSave() {
    setSaving(true)
    const accountsSnapshot: SnapshotAccount[] = accounts.map(a => ({
      id: a.id, name: a.name, category: a.category, inr: computeNetInr(a, usdInr, cadInr),
    }))
    await saveSnapshot(liquid, appreciating, investments, depreciating, note, false, accountsSnapshot)
    setSaving(false)
    setShowModal(false)
    setNote('')
  }

  // Split snapshots into V2 (new) and V1 (legacy)
  const v2Snapshots = [...snapshots].filter(s => s.version === 2).reverse()
  const v1Snapshots = [...snapshots].filter(s => !s.version || s.version === 1).reverse()

  const chartData = snapshots.slice(-40).map(s => ({
    date: s.date.slice(5),
    total: Math.round(s.total / 1_00_000),
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const snap = snapshots.find(s => s.date.slice(5) === label)
    return (
      <Paper elevation={3} sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{snap ? isoToDisplay(snap.date) : label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{payload[0].value}L</Typography>
        {snap?.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 180 }}>{snap.notes}</Typography>}
      </Paper>
    )
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
      <CircularProgress />
    </Box>
  )

  const notesCell = (s: typeof snapshots[0]) => (
    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, maxWidth: 200 }}>
      {!isReadOnly && editCell?.id === s.id ? (
        <TextField
          size="small"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitNotesEdit}
          onKeyDown={handleCellKey}
          autoFocus
          fullWidth
          sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
        />
      ) : (
        <Tooltip title={s.notes || ''} placement="top-start" disableHoverListener={!s.notes} arrow>
          <Typography
            variant="body2"
            color="text.secondary"
            onClick={() => !isReadOnly && startNotesEdit(s.id, s.notes)}
            sx={{ cursor: isReadOnly ? 'default' : 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': isReadOnly ? {} : { color: 'text.primary' } }}
          >
            {s.notes || '—'}
          </Typography>
        </Tooltip>
      )}
    </TableCell>
  )

  const deleteCell = (s: typeof snapshots[0]) => (
    <TableCell padding="checkbox">
      {!isReadOnly && (
        <IconButton
          size="small"
          onClick={async () => {
            const ok = await confirm({ title: 'Delete snapshot', message: `Delete snapshot for ${isoToDisplay(s.date)}?` })
            if (ok) removeSnapshot(s.id)
          }}
          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, opacity: 0, '.MuiTableRow-root:hover &': { opacity: 1 } }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </TableCell>
  )

  const diffCell = (s: typeof snapshots[0]) => (
    <TableCell align="right">
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, color: diffClass(s.difference) === 'positive' ? 'success.main' : diffClass(s.difference) === 'negative' ? 'error.main' : 'text.secondary' }}
      >
        {fmtDiff(s.difference)}
      </Typography>
    </TableCell>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Snapshots</Typography>
        {!isReadOnly && (
          <Button variant="outlined" size="small" startIcon={<CameraAltOutlinedIcon />} onClick={() => setShowModal(true)}>
            Save Snapshot
          </Button>
        )}
      </Box>

      {/* Chart — spans all snapshots */}
      {chartData.length > 1 && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid #1f2937' }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Net Worth over time (₹ Lakhs)</Typography>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}L`} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#60a5fa' }} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* ── V2 Snapshots ── */}
      {v2Snapshots.length > 0 && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1f2937', mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#0f172a' }}>
                <TableCell>Date</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: '#38bdf8' }}>Liquid</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: '#34d399' }}>Appreciating</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: '#a78bfa' }}>Investments</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' }, color: '#fbbf24' }}>Depreciating</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Diff</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Notes</TableCell>
                <TableCell padding="checkbox" />
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {v2Snapshots.map(s => (
                <Fragment key={s.id}>
                  <TableRow hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{isoToDisplay(s.date)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.liquid)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.appreciating)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.investments ?? 0)}</TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.depreciating)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>₹{fmtINR(s.total)}</Typography>
                    </TableCell>
                    {diffCell(s)}
                    {notesCell(s)}
                    <TableCell padding="checkbox">
                      {s.accounts && s.accounts.length > 0 && (
                        <IconButton
                          size="small"
                          onClick={() => setExpandedRow(expandedRow === s.id ? null : s.id)}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                        >
                          {expandedRow === s.id
                            ? <ExpandLessIcon sx={{ fontSize: 16 }} />
                            : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                        </IconButton>
                      )}
                    </TableCell>
                    {deleteCell(s)}
                  </TableRow>

                  {/* Per-account breakdown */}
                  {s.accounts && s.accounts.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={10} sx={{ py: 0, border: 0, bgcolor: '#0a0f1a' }}>
                        <Collapse in={expandedRow === s.id} unmountOnExit>
                          <Box sx={{ py: 2, px: 2 }}>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10 }}>
                              Per-account breakdown
                            </Typography>
                            <Grid container spacing={1}>
                              {s.accounts.map(acc => (
                                <Grid key={acc.id} size={{ xs: 6, sm: 3 }}>
                                  <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #1f2937', bgcolor: '#111827' }}>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', fontSize: 11 }}>
                                      {acc.name}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>
                                      ₹{fmtINR(acc.inr)}
                                    </Typography>
                                  </Paper>
                                </Grid>
                              ))}
                            </Grid>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          {v2Snapshots.length === 0 && (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>No snapshots yet.</Typography>
          )}
        </TableContainer>
      )}

      {/* ── V1 Legacy Snapshots ── */}
      {v1Snapshots.length > 0 && (
        <Box>
          <Box
            component="button"
            onClick={() => setShowLegacy(v => !v)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, background: 'none', border: 'none', cursor: 'pointer', color: 'text.disabled', p: 0 }}
          >
            {showLegacy
              ? <ExpandLessIcon sx={{ fontSize: 16 }} />
              : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            <Typography variant="caption" sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Legacy snapshots ({v1Snapshots.length})
            </Typography>
          </Box>

          <Collapse in={showLegacy}>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1f2937', opacity: 0.7 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#0f172a' }}>
                    <TableCell>Date</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Liquid</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Appreciating</TableCell>
                    <TableCell align="right" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Depreciating</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="right">Diff</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Notes</TableCell>
                    <TableCell padding="checkbox" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {v1Snapshots.map(s => (
                    <TableRow key={s.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{isoToDisplay(s.date)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.liquid)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.appreciating)}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.depreciating)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>₹{fmtINR(s.total)}</Typography>
                      </TableCell>
                      {diffCell(s)}
                      {notesCell(s)}
                      {deleteCell(s)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>
        </Box>
      )}

      {snapshots.length === 0 && (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>No snapshots yet.</Typography>
      )}

      {/* Save modal */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save Snapshot</DialogTitle>
        <DialogContent>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {[
              ['Liquid', liquid, '#38bdf8'],
              ['Appreciating', appreciating, '#34d399'],
              ['Investments', investments, '#a78bfa'],
              ['Depreciating', depreciating, '#fbbf24'],
            ].map(([l, v, c]) => (
              <Grid key={String(l)} size={{ xs: 6 }}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: '#0f172a', border: '1px solid #1f2937' }}>
                  <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color: String(c) }}>{l}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>₹{fmtINR(Number(v))}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Total: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>₹{fmtINR(liquid + appreciating + investments + depreciating)}</Box>
          </Typography>
          <TextField label="Note (optional)" size="small" fullWidth placeholder="What happened this period?" value={note} onChange={e => setNote(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowModal(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
