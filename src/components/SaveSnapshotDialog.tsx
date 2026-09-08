import { useEffect, useState } from 'react'
import {
  Box, Grid, Paper, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, CircularProgress,
} from '@mui/material'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { useSnapshotStore } from '../store/snapshotStore'
import type { Category, Snapshot, SnapshotAccount } from '../types'
import { fmtINR } from '../lib/fmt'

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'liquid',       label: 'Liquid',       color: '#38bdf8' },
  { key: 'appreciating', label: 'Appreciating', color: '#34d399' },
  { key: 'investments',  label: 'Investments',  color: '#a78bfa' },
  { key: 'depreciating', label: 'Depreciating', color: '#fbbf24' },
]

/**
 * Single source of truth for saving a snapshot. Both Accounts and Snapshots
 * open this, so the overwrite prompt and the totals can't drift apart.
 */
export default function SaveSnapshotDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { accounts, loading: accountsLoading, load: loadAccounts } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const { saveSnapshot, findTodaySnapshot } = useSnapshotStore()

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<'compose' | 'confirm-overwrite'>('compose')
  const [existing, setExisting] = useState<Snapshot | null>(null)

  // Totals come from the accounts list, which the opening page may not have
  // loaded. Without this the dialog would happily save an all-zero snapshot.
  useEffect(() => {
    if (open && accounts.length === 0) loadAccounts()
  }, [open])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const totalFor = (cat: Category) =>
    accounts.filter(a => a.category === cat).reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  const liquid       = totalFor('liquid')
  const appreciating = totalFor('appreciating')
  const investments  = totalFor('investments')
  const depreciating = totalFor('depreciating')
  const netWorth     = liquid + appreciating + investments + depreciating

  // Rates matter as much as accounts: saving before they arrive would convert
  // USD/CAD at the hardcoded fallbacks and bake wrong figures into history.
  const ready = accounts.length > 0 && !!rates
  const empty = !accountsLoading && accounts.length === 0

  function close() {
    onClose()
    setStep('compose')
    setNote('')
    setExisting(null)
  }

  const existingNote = existing?.notes?.trim() ?? ''

  function mergeNotes() {
    const mine = note.trim()
    setNote(mine ? `${existingNote} · ${mine}` : existingNote)
  }

  // Every action funnels through this, so the button can't be fired twice while
  // an await is in flight — including the checkTodayExists() network round-trip.
  async function guarded(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const handleSave = () => guarded(async () => {
    if (step === 'compose') {
      const today = await findTodaySnapshot()
      if (today) {
        setExisting(today)
        setStep('confirm-overwrite')
        return
      }
    }
    await writeSnapshot(true)
  })

  async function writeSnapshot(overwrite: boolean) {
    const accountsSnapshot: SnapshotAccount[] = accounts.map(a => ({
      id: a.id, name: a.name, category: a.category, inr: computeNetInr(a, usdInr, cadInr),
    }))
    await saveSnapshot(liquid, appreciating, investments, depreciating, note, overwrite, accountsSnapshot)
    close()
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {step === 'confirm-overwrite' ? 'Snapshot already exists for today' : 'Save Snapshot'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {step === 'confirm-overwrite' ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A snapshot for today already exists. Overwriting replaces its values and its note.
            </Typography>

            {/* What the totals would change from → to */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.disabled">Total</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', textDecoration: 'line-through' }}>
                ₹{fmtINR(existing?.total ?? 0)}
              </Typography>
              <Typography variant="caption" color="text.disabled">→</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{fmtINR(netWorth)}</Typography>
            </Box>

            {/* Existing note, with actions to pull it into the final note */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, minHeight: 24 }}>
                <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: '0.04em' }}>
                  EXISTING NOTE
                </Typography>
                {existingNote && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button size="small" onClick={() => setNote(existingNote)}
                      sx={{ fontSize: 11, minWidth: 0, px: 1, py: 0.25 }}>
                      Use
                    </Button>
                    <Button size="small" onClick={mergeNotes} disabled={!note.trim()}
                      sx={{ fontSize: 11, minWidth: 0, px: 1, py: 0.25 }}>
                      Merge
                    </Button>
                  </Box>
                )}
              </Box>
              <Paper elevation={0} sx={{ p: 1.25, bgcolor: 'var(--surface-card)', border: '1px solid var(--border-main)' }}>
                <Typography variant="body2" sx={{ fontSize: 13, whiteSpace: 'pre-wrap', color: existingNote ? 'text.primary' : 'text.disabled' }}>
                  {existingNote || 'No note on the existing snapshot.'}
                </Typography>
              </Paper>
            </Box>

            <TextField
              label="Final note"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={note}
              onChange={e => setNote(e.target.value)}
              helperText="This is what gets saved, on either choice below."
            />
          </>
        ) : empty ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: 'center' }}>
            No accounts to snapshot.
          </Typography>
        ) : !ready ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 4 }}>
            <CircularProgress size={24} />
            <Typography variant="caption" color="text.disabled">
              {!rates ? 'Fetching exchange rates…' : 'Loading balances…'}
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {CATEGORIES.map(({ key, label, color }) => (
                <Grid key={key} size={{ xs: 6 }}>
                  <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', bgcolor: 'var(--surface-card)', border: '1px solid var(--border-main)' }}>
                    <Typography variant="caption" sx={{ display: 'block', fontSize: 10, color }}>{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12 }}>₹{fmtINR(totalFor(key))}</Typography>
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
              placeholder="What happened this period?"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {step === 'confirm-overwrite' ? (
          <>
            <Button onClick={close} color="inherit">Cancel</Button>
            <Button onClick={() => guarded(() => writeSnapshot(false))} variant="outlined" disabled={busy}>
              Add new row
            </Button>
            <Button onClick={() => guarded(() => writeSnapshot(true))} variant="contained" disabled={busy}>
              {busy ? <CircularProgress size={16} color="inherit" /> : 'Overwrite'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close} color="inherit">Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={busy || !ready}>
              {busy ? <CircularProgress size={16} color="inherit" /> : 'Save'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
