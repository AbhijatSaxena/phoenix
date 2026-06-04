import { useEffect, useState } from 'react'
import {
  Box, Paper, Grid, Typography, Button, TextField, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Checkbox,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  fetchZerodhaConfig, saveZerodhaConfig,
  fetchZerodhaEntries, upsertZerodhaEntry, deleteZerodhaEntry,
} from '../services/firebase'
import type { ZerodhaConfig, ZerodhaEntry } from '../types'
import { confirm } from '../components/ConfirmDialog'
import { fmtINR, isoToDisplay } from '../lib/fmt'
import { useForm } from 'react-hook-form'
import { useIsReadOnly } from '../store/authStore'

type EntryForm = Omit<ZerodhaEntry, 'id'>

function netTotal(e: ZerodhaEntry) {
  return e.equityRealized + e.equityUnrealized + e.fnoRealized + e.fnoUnrealized
    + e.commoditiesRealized + e.commoditiesUnrealized + e.mfRealized + e.mfUnrealized
}

export default function ZerodhaPage() {
  const [config, setConfig]   = useState<ZerodhaConfig | null>(null)
  const [entries, setEntries] = useState<ZerodhaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editCapital, setEditCapital] = useState(false)
  const [capitalInput, setCapitalInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [copyPrev, setCopyPrev] = useState<Partial<Record<keyof EntryForm, boolean>>>({})

  const { register, handleSubmit, reset, setValue } = useForm<EntryForm>()
  const isReadOnly = useIsReadOnly()

  useEffect(() => {
    async function load() {
      const [cfg, rows] = await Promise.all([fetchZerodhaConfig(), fetchZerodhaEntries()])
      setConfig((cfg as ZerodhaConfig) ?? { capital: 0 })
      setEntries(rows as ZerodhaEntry[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !config) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}><CircularProgress /></Box>

  const latest    = entries.length > 0 ? entries[entries.length - 1] : null
  const latestNet = latest ? netTotal(latest) : null
  const plPct     = latestNet !== null && config.capital > 0 ? (latestNet / config.capital) * 100 : null

  async function commitCapital() {
    const val = parseFloat(capitalInput)
    if (!isNaN(val)) {
      const updated = { capital: val }
      setConfig(updated)
      await saveZerodhaConfig(updated)
    }
    setEditCapital(false)
  }

  function handleCopyCheck(key: keyof EntryForm, checked: boolean) {
    setCopyPrev(prev => ({ ...prev, [key]: checked }))
    if (checked && latest) {
      setValue(key, latest[key as keyof ZerodhaEntry] as any)
    } else {
      setValue(key, '' as any)
    }
  }

  async function onSubmit(data: EntryForm) {
    setSaving(true)
    const entry = {
      ...data,
      id: editingId ?? undefined,
      equityRealized:        Number(data.equityRealized),
      equityUnrealized:      Number(data.equityUnrealized),
      fnoRealized:           Number(data.fnoRealized),
      fnoUnrealized:         Number(data.fnoUnrealized),
      commoditiesRealized:   Number(data.commoditiesRealized),
      commoditiesUnrealized: Number(data.commoditiesUnrealized),
      mfRealized:            Number(data.mfRealized),
      mfUnrealized:          Number(data.mfUnrealized),
    } as ZerodhaEntry
    await upsertZerodhaEntry(entry as unknown as Record<string, unknown>)
    setEntries(await fetchZerodhaEntries() as ZerodhaEntry[])
    reset()
    setCopyPrev({})
    setShowForm(false)
    setEditingId(null)
    setSaving(false)
  }

  function openEdit(e: ZerodhaEntry) {
    setEditingId(e.id)
    const { id, ...rest } = e
    Object.entries(rest).forEach(([k, v]) => setValue(k as keyof EntryForm, v as any))
    setShowForm(true)
  }

  async function removeEntry(id: string) {
    const entry = entries.find(e => e.id === id)
    const ok = await confirm({ title: 'Remove portfolio entry', message: `Remove the entry dated ${entry?.date}?` })
    if (!ok) return
    await deleteZerodhaEntry(id)
    setEntries(entries.filter(e => e.id !== id))
  }

  const fields: { key: keyof EntryForm; label: string }[] = [
    { key: 'date',                  label: 'Date' },
    { key: 'equityRealized',        label: 'Equity Realized' },
    { key: 'equityUnrealized',      label: 'Equity Unrealized' },
    { key: 'fnoRealized',           label: 'F&O Realized' },
    { key: 'fnoUnrealized',         label: 'F&O Unrealized' },
    { key: 'commoditiesRealized',   label: 'Commodities Realized' },
    { key: 'commoditiesUnrealized', label: 'Commodities Unrealized' },
    { key: 'mfRealized',            label: 'MF Realized' },
    { key: 'mfUnrealized',          label: 'MF Unrealized' },
  ]

  const pnlColor = (v: number | null) => v === null ? 'text.secondary' : v >= 0 ? 'success.main' : 'error.main'

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Zerodha Portfolio</Typography>

      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', fontSize: 10 }}>Capital Invested</Typography>
            {!isReadOnly && editCapital ? (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField size="small" type="number" value={capitalInput} onChange={e => setCapitalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && commitCapital()} autoFocus sx={{ flex: 1 }} />
                <Button variant="contained" size="small" onClick={commitCapital} sx={{ minWidth: 0, px: 1.5 }}>OK</Button>
              </Box>
            ) : isReadOnly ? (
              <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>₹{fmtINR(config.capital)}</Typography>
            ) : (
              <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                onClick={() => { setEditCapital(true); setCapitalInput(String(config.capital)) }}>
                ₹{fmtINR(config.capital)}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', fontSize: 10 }}>Latest Net P&L</Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5, color: pnlColor(latestNet) }}>
              {latestNet !== null ? `₹${fmtINR(latestNet)}` : '—'}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', fontSize: 10 }}>P/L %</Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5, color: pnlColor(plPct) }}>
              {plPct !== null ? `${plPct.toFixed(2)}%` : '—'}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="outlined" size="small" startIcon={<AddIcon />}
            onClick={() => { setShowForm(v => !v); setEditingId(null); reset(); setCopyPrev({}) }}>
            {showForm ? 'Cancel' : 'Add Entry'}
          </Button>
        </Box>
      )}

      <Dialog open={showForm} onClose={() => { setShowForm(false); setEditingId(null); reset(); setCopyPrev({}) }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Entry' : 'New Entry'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              {fields.map(({ key, label }) => (
                <Grid key={key} size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={label}
                    type={key === 'date' ? 'date' : 'number'}
                    slotProps={{ htmlInput: { step: 'any' }, inputLabel: { shrink: true } }}
                    size="small"
                    fullWidth
                    {...register(key, { required: true })}
                  />
                  {key !== 'date' && !editingId && latest && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.25 }}>
                      <Checkbox
                        size="small"
                        checked={!!copyPrev[key]}
                        onChange={e => handleCopyCheck(key, e.target.checked)}
                        sx={{ p: 0.25 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                        Copy prev: ₹{fmtINR(Number(latest[key as keyof ZerodhaEntry] ?? 0))}
                      </Typography>
                    </Box>
                  )}
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => { setShowForm(false); setEditingId(null); reset(); setCopyPrev({}) }} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1f2937' }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#0f172a' }}>
              <TableCell>Date</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Equity R</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Equity U</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>F&O R</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>F&O U</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Commod R</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Commod U</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>MF R</TableCell>
              <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>MF U</TableCell>
              <TableCell align="right">Net Total</TableCell>
              <TableCell align="right">P/L%</TableCell>
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {[...entries].reverse().map(e => {
              const net = netTotal(e)
              const pct = config.capital > 0 ? (net / config.capital) * 100 : 0
              return (
                <TableRow key={e.id} hover>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{isoToDisplay(e.date)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.equityRealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.equityUnrealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.fnoRealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.fnoUnrealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.commoditiesRealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.commoditiesUnrealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.mfRealized)}</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', display: { xs: 'none', md: 'table-cell' } }}>₹{fmtINR(e.mfUnrealized)}</TableCell>
                  <TableCell align="right" sx={{ color: pnlColor(net), fontWeight: 500 }}>₹{fmtINR(net)}</TableCell>
                  <TableCell align="right" sx={{ color: pnlColor(pct), fontWeight: 500 }}>{pct.toFixed(2)}%</TableCell>
                  <TableCell padding="checkbox">
                    {!isReadOnly && (
                      <Box sx={{ display: 'flex', gap: 0.25, opacity: 0, '.MuiTableRow-root:hover &': { opacity: 1 } }}>
                        <IconButton size="small" onClick={() => openEdit(e)} sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' }, p: 0.5 }}>
                          <EditOutlinedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton size="small" onClick={() => removeEntry(e.id)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, p: 0.5 }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {entries.length === 0 && <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>No entries yet.</Typography>}
      </TableContainer>
    </Box>
  )
}
