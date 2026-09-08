import { useEffect, useState } from 'react'
import {
  Box, Grid, Paper, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, CircularProgress,
} from '@mui/material'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { useSnapshotStore } from '../store/snapshotStore'
import type { Category, SnapshotAccount } from '../types'
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
  const { accounts, load: loadAccounts } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const { saveSnapshot, checkTodayExists } = useSnapshotStore()

  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const [step, setStep]     = useState<'compose' | 'confirm-overwrite'>('compose')

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

  const ready = accounts.length > 0

  function close() {
    onClose()
    setStep('compose')
    setNote('')
  }

  async function handleSave() {
    if (step === 'compose' && await checkTodayExists()) {
      setStep('confirm-overwrite')
      return
    }
    await doSave(true)
  }

  async function doSave(overwrite: boolean) {
    const accountsSnapshot: SnapshotAccount[] = accounts.map(a => ({
      id: a.id, name: a.name, category: a.category, inr: computeNetInr(a, usdInr, cadInr),
    }))
    setSaving(true)
    await saveSnapshot(liquid, appreciating, investments, depreciating, note, overwrite, accountsSnapshot)
    setSaving(false)
    close()
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        {step === 'confirm-overwrite' ? 'Snapshot already exists for today' : 'Save Snapshot'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {step === 'confirm-overwrite' ? (
          <Typography variant="body2" color="text.secondary">
            A snapshot for today already exists. Overwrite it, or keep both as separate rows?
          </Typography>
        ) : !ready ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
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
            <Button onClick={() => doSave(false)} variant="outlined" disabled={saving}>Add new row</Button>
            <Button onClick={() => doSave(true)} variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={16} color="inherit" /> : 'Overwrite'}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close} color="inherit">Cancel</Button>
            <Button onClick={handleSave} variant="contained" disabled={saving || !ready}>
              {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
