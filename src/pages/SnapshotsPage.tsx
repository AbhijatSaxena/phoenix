import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Button, CircularProgress, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
} from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import DeleteIcon from '@mui/icons-material/Delete'
import { confirm } from '../components/ConfirmDialog'
import { useSnapshotStore } from '../store/snapshotStore'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { fmtINR, fmtDiff, diffClass, isoToDisplay } from '../lib/fmt'
import { useIsReadOnly } from '../store/authStore'
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

export default function SnapshotsPage() {
  const { snapshots, loading, load, saveSnapshot, updateSnapshot, removeSnapshot } = useSnapshotStore()
  const accounts   = useDashboardStore(s => s.accounts)
  const rates      = useRatesStore(s => s.rates)
  const [showModal, setShowModal] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const isReadOnly = useIsReadOnly()

  type EditField = 'total' | 'difference' | 'notes'
  const [editCell, setEditCell] = useState<{ id: string; field: EditField } | null>(null)
  const [editValue, setEditValue] = useState('')

  function startCellEdit(id: string, field: EditField, current: string) {
    setEditCell({ id, field })
    setEditValue(current)
  }

  async function commitCellEdit() {
    if (!editCell) return
    const snap = snapshots.find(s => s.id === editCell.id)
    if (!snap) { setEditCell(null); return }
    if (editCell.field === 'total') {
      const newTotal = parseFloat(editValue)
      if (!isNaN(newTotal)) await updateSnapshot({ ...snap, total: newTotal })
    } else if (editCell.field === 'difference') {
      const newDiff = editValue === '' ? null : parseFloat(editValue)
      if (editValue === '' || !isNaN(newDiff as number)) await updateSnapshot({ ...snap, difference: newDiff })
    } else {
      await updateSnapshot({ ...snap, notes: editValue })
    }
    setEditCell(null)
  }

  function handleCellKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitCellEdit()
    if (e.key === 'Escape') setEditCell(null)
  }

  useEffect(() => { load() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const liquid       = accounts.filter(a => a.category === 'liquid').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const appreciating = accounts.filter(a => a.category === 'appreciating').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const depreciating = accounts.filter(a => a.category === 'depreciating').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  async function handleSave() {
    setSaving(true)
    await saveSnapshot(liquid, appreciating, depreciating, note, false)
    setSaving(false)
    setShowModal(false)
    setNote('')
  }

  const chartData = snapshots.slice(-40).map(s => ({
    date: s.date.slice(5),
    total: Math.round(s.total / 1_00_000),
    label: s.date,
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

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}><CircularProgress /></Box>

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

      {/* Chart */}
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

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1f2937' }}>
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
            {[...snapshots].reverse().map(s => (
              <TableRow key={s.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{isoToDisplay(s.date)}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.liquid)}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.appreciating)}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'table-cell' } }}>₹{fmtINR(s.depreciating)}</TableCell>

                <TableCell align="right">
                  {!isReadOnly && editCell?.id === s.id && editCell.field === 'total' ? (
                    <TextField
                      size="small"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitCellEdit}
                      onKeyDown={handleCellKey}
                      autoFocus
                      slotProps={{ htmlInput: { style: { textAlign: 'right', width: 100 } } }}
                      sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
                    />
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, cursor: isReadOnly ? 'default' : 'pointer', '&:hover': isReadOnly ? {} : { textDecoration: 'underline' } }}
                      onClick={() => !isReadOnly && startCellEdit(s.id, 'total', String(s.total))}
                    >
                      ₹{fmtINR(s.total)}
                    </Typography>
                  )}
                </TableCell>

                <TableCell align="right">
                  {!isReadOnly && editCell?.id === s.id && editCell.field === 'difference' ? (
                    <TextField
                      size="small"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitCellEdit}
                      onKeyDown={handleCellKey}
                      autoFocus
                      slotProps={{ htmlInput: { style: { textAlign: 'right', width: 100 } } }}
                      sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
                    />
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, cursor: isReadOnly ? 'default' : 'pointer', color: diffClass(s.difference) === 'positive' ? 'success.main' : diffClass(s.difference) === 'negative' ? 'error.main' : 'text.secondary', '&:hover': isReadOnly ? {} : { textDecoration: 'underline' } }}
                      onClick={() => !isReadOnly && startCellEdit(s.id, 'difference', s.difference == null ? '' : String(s.difference))}
                    >
                      {fmtDiff(s.difference)}
                    </Typography>
                  )}
                </TableCell>

                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' }, maxWidth: 200 }}>
                  {!isReadOnly && editCell?.id === s.id && editCell.field === 'notes' ? (
                    <TextField
                      size="small"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitCellEdit}
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
                        onClick={() => !isReadOnly && startCellEdit(s.id, 'notes', s.notes)}
                        sx={{ cursor: isReadOnly ? 'default' : 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': isReadOnly ? {} : { color: 'text.primary' } }}
                      >
                        {s.notes || '—'}
                      </Typography>
                    </Tooltip>
                  )}
                </TableCell>

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
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {snapshots.length === 0 && (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>No snapshots yet.</Typography>
        )}
      </TableContainer>

      {/* Save modal */}
      <Dialog open={showModal} onClose={() => setShowModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save Snapshot</DialogTitle>
        <DialogContent>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {[['Liquid', liquid], ['Appreciating', appreciating], ['Depreciating', depreciating]].map(([l, v]) => (
              <Grid key={String(l)} size={{ xs: 4 }}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: '#0f172a', border: '1px solid #1f2937' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10 }}>{l}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>₹{fmtINR(Number(v))}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Total: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>₹{fmtINR(liquid + appreciating + depreciating)}</Box>
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
