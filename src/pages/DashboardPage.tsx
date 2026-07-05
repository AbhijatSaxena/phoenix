import { useEffect, useState } from 'react'
import {
  Box, Grid, Paper, Typography, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material'
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined'
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { useSnapshotStore } from '../store/snapshotStore'
import type { Category, SnapshotAccount } from '../types'
import { fmtINR, isoToDisplay } from '../lib/fmt'
import { useIsReadOnly } from '../store/authStore'
import { useLinksStore } from '../store/linksStore'

const CATEGORY_META: { key: Category; label: string; color: string }[] = [
  { key: 'liquid',       label: 'Liquid',       color: '#38bdf8' },
  { key: 'appreciating', label: 'Appreciating', color: '#34d399' },
  { key: 'investments',  label: 'Investments',  color: '#a78bfa' },
  { key: 'depreciating', label: 'Depreciating', color: '#fbbf24' },
]

export default function DashboardPage() {
  const { accounts, loading, load } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const { snapshots, load: loadSnapshots, saveSnapshot, checkTodayExists } = useSnapshotStore()
  const { links, load: loadLinks } = useLinksStore()
  const isReadOnly = useIsReadOnly()

  const [snapshotNote, setSnapshotNote] = useState('')
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [snapshotStep, setSnapshotStep] = useState<'compose' | 'confirm-overwrite'>('compose')

  useEffect(() => { load(); loadLinks(); loadSnapshots() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const sectionTotal = (cat: Category) =>
    accounts.filter(a => a.category === cat).reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  const liquid       = sectionTotal('liquid')
  const appreciating = sectionTotal('appreciating')
  const investments  = sectionTotal('investments')
  const depreciating = sectionTotal('depreciating')
  const netWorth     = liquid + appreciating + investments + depreciating

  function buildAccountsSnapshot(): SnapshotAccount[] {
    return accounts.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      inr: computeNetInr(a, usdInr, cadInr),
    }))
  }

  async function handleSaveSnapshot() {
    if (snapshotStep === 'compose' && checkTodayExists()) {
      setSnapshotStep('confirm-overwrite')
      return
    }
    await doSave(true)
  }

  async function doSave(overwrite: boolean) {
    setSavingSnapshot(true)
    await saveSnapshot(liquid, appreciating, investments, depreciating, snapshotNote, overwrite, buildAccountsSnapshot())
    await loadSnapshots()
    setSavingSnapshot(false)
    setShowSnapshotModal(false)
    setSnapshotNote('')
    setSnapshotStep('compose')
  }

  function closeSnapshotModal() {
    setShowSnapshotModal(false)
    setSnapshotStep('compose')
    setSnapshotNote('')
  }

  const chartData = snapshots.slice(-40).map(s => ({
    date: s.date.slice(5),
    total: Math.round(s.total / 1_00_000),
    fullDate: s.date,
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

  return (
    <Box>
      {/* Quick Links */}
      {links.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {links.map(link => (
            <Box
              key={link.id}
              component="a"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.5, py: 0.75, borderRadius: '8px',
                border: '1px solid var(--border-main)',
                bgcolor: 'var(--surface-card)',
                color: 'text.secondary', textDecoration: 'none',
                fontSize: 12, fontWeight: 500,
                transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                '&:hover': { borderColor: 'primary.main', color: 'text.primary', bgcolor: 'background.paper' },
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{link.emoji}</span>
              {link.title}
            </Box>
          ))}
        </Box>
      )}

      {/* Summary tiles */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {CATEGORY_META.map(({ key, label, color }) => (
          <Grid key={key} size={{ xs: 6 }}>
            <Paper elevation={0} sx={{ p: 2, textAlign: 'center', border: '1px solid var(--border-main)' }}>
              <Typography variant="overline" sx={{ fontSize: 10, color: 'text.secondary', display: 'block' }}>{label}</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color }}>
                ₹{fmtINR(sectionTotal(key))}
              </Typography>
            </Paper>
          </Grid>
        ))}
        <Grid size={{ xs: 12 }}>
          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', border: '1px solid var(--border-main)' }}>
            <Typography variant="overline" sx={{ fontSize: 10, color: 'text.secondary', display: 'block' }}>Net Worth</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              ₹{fmtINR(netWorth)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Snapshot button */}
      {!isReadOnly && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Button variant="outlined" size="small" startIcon={<CameraAltOutlinedIcon />} onClick={() => setShowSnapshotModal(true)}>
            Save Snapshot
          </Button>
        </Box>
      )}

      {/* Net Worth trend chart */}
      {chartData.length > 1 && (
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid var(--border-main)' }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Net Worth over time (₹ Lakhs)</Typography>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}L`} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#60a5fa' }} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

      {/* Snapshot dialog */}
      <Dialog open={showSnapshotModal} onClose={closeSnapshotModal} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          {snapshotStep === 'confirm-overwrite' ? 'Snapshot already exists for today' : 'Save Snapshot'}
        </DialogTitle>
        <DialogContent>
          {snapshotStep === 'confirm-overwrite' ? (
            <Typography variant="body2" color="text.secondary">
              A snapshot for today already exists. What would you like to do?
            </Typography>
          ) : (
            <>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                {CATEGORY_META.map(({ key, label, color }) => (
                  <Grid key={key} size={{ xs: 6 }}>
                    <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: 'var(--surface-card)', border: '1px solid var(--border-main)' }}>
                      <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>₹{fmtINR(sectionTotal(key))}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Total: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>₹{fmtINR(netWorth)}</Box>
              </Typography>
              <TextField
                label="Note (optional)"
                size="small"
                fullWidth
                placeholder="e.g. Salary came, crypto went up..."
                value={snapshotNote}
                onChange={e => setSnapshotNote(e.target.value)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {snapshotStep === 'confirm-overwrite' ? (
            <>
              <Button onClick={closeSnapshotModal} color="inherit">Cancel</Button>
              <Button onClick={() => doSave(false)} variant="outlined" disabled={savingSnapshot}>Add new row</Button>
              <Button onClick={() => doSave(true)} variant="contained" disabled={savingSnapshot}>
                {savingSnapshot ? <CircularProgress size={16} color="inherit" /> : 'Overwrite'}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={closeSnapshotModal} color="inherit">Cancel</Button>
              <Button onClick={handleSaveSnapshot} variant="contained" disabled={savingSnapshot}>
                {savingSnapshot ? <CircularProgress size={16} color="inherit" /> : 'Save'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
