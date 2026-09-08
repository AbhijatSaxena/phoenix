import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Button, TextField, CircularProgress, IconButton,
  LinearProgress, Slider, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, Chip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { useAffordabilityStore } from '../store/affordabilityStore'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { confirm } from '../components/ConfirmDialog'
import { useIsReadOnly } from '../store/authStore'
import type { AffordabilityPlan, AffordabilityAllocation, Account } from '../types'
import { fmtINR } from '../lib/fmt'

// Two decimals, so an amount typed on the right can round-trip to a percentage
// without visibly drifting from what was entered.
const clampPct = (n: number) =>
  isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 100) / 100)) : 0

/** Inline click-to-edit for the plan's target amount. */
function EditableAmount({ value, onCommit, isReadOnly }: {
  value: number; onCommit: (v: number) => void; isReadOnly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  function commit() {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) onCommit(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <TextField
        size="small" type="number" value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        onClick={e => e.stopPropagation()}
        slotProps={{ htmlInput: { style: { textAlign: 'right', width: 130, fontWeight: 700 } } }}
      />
    )
  }
  return (
    <Typography
      variant="h6"
      onClick={e => { if (!isReadOnly) { e.stopPropagation(); setVal(String(value)); setEditing(true) } }}
      sx={{
        fontWeight: 700, fontSize: 18,
        cursor: isReadOnly ? 'default' : 'pointer',
        '&:hover': isReadOnly ? {} : { textDecoration: 'underline' },
      }}
    >
      ₹{fmtINR(value)}
    </Typography>
  )
}

/** One account's share within a plan. */
function AllocationRow({ alloc, account, isReadOnly, onCommit, onRemove }: {
  alloc: AffordabilityAllocation
  account: Account | undefined
  isReadOnly: boolean
  onCommit: (percent: number) => void
  onRemove: () => void
}) {
  const rates  = useRatesStore(s => s.rates)
  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  // Local state so dragging is smooth; only the released value is persisted.
  const [pct, setPct] = useState(alloc.percent)
  useEffect(() => { setPct(alloc.percent) }, [alloc.percent])

  const [amtEditing, setAmtEditing] = useState(false)
  const [amtDraft, setAmtDraft]     = useState('')

  const available   = account ? computeNetInr(account, usdInr, cadInr) : 0
  const contributes = available * pct / 100

  // Only meaningful to work backwards from an amount if there's a positive
  // balance to take a share of.
  const amountEditable = !isReadOnly && available > 0
  const draftNum = parseFloat(amtDraft)
  const overMax  = !isNaN(draftNum) && draftNum > available

  function commitAmount() {
    const amt = parseFloat(amtDraft)
    if (!isNaN(amt) && available > 0) {
      const capped   = Math.min(Math.max(amt, 0), available)   // never above 100%
      const nextPct  = clampPct((capped / available) * 100)
      setPct(nextPct)
      onCommit(nextPct)
    }
    setAmtEditing(false)
  }

  return (
    <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid var(--border-main)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1, minWidth: 0 }} noWrap>
          {account ? account.name : 'Removed account'}
        </Typography>
        {!account && <Chip label="missing" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
        <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
          ₹{fmtINR(available)} available
        </Typography>
        {!isReadOnly && (
          <IconButton size="small" onClick={onRemove} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, p: 0.25 }}>
            <DeleteIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Slider
          value={pct}
          onChange={(_, v) => setPct(v as number)}
          onChangeCommitted={(_, v) => onCommit(clampPct(v as number))}
          disabled={isReadOnly}
          min={0} max={100}
          size="small"
          sx={{ flex: 1 }}
        />
        <TextField
          size="small" type="number" value={pct}
          disabled={isReadOnly}
          onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setPct(clampPct(v)) }}
          onBlur={() => onCommit(clampPct(pct))}
          onKeyDown={e => { if (e.key === 'Enter') onCommit(clampPct(pct)) }}
          slotProps={{ htmlInput: { min: 0, max: 100, style: { width: 56, textAlign: 'right', padding: '6px 8px' } } }}
        />
        <Typography variant="caption" color="text.disabled">%</Typography>

        {/* Amount side — editing it back-solves the percentage */}
        {amtEditing ? (
          <TextField
            size="small" type="number" value={amtDraft} autoFocus
            error={overMax}
            onChange={e => setAmtDraft(e.target.value)}
            onBlur={commitAmount}
            onKeyDown={e => { if (e.key === 'Enter') commitAmount(); if (e.key === 'Escape') setAmtEditing(false) }}
            slotProps={{ htmlInput: { min: 0, max: available, style: { width: 110, textAlign: 'right', padding: '6px 8px' } } }}
          />
        ) : (
          <Typography
            variant="body2"
            onClick={() => {
              if (!amountEditable) return
              setAmtDraft(String(Math.round(contributes)))
              setAmtEditing(true)
            }}
            sx={{
              fontWeight: 600, minWidth: 110, textAlign: 'right',
              cursor: amountEditable ? 'pointer' : 'default',
              '&:hover': amountEditable ? { textDecoration: 'underline' } : {},
            }}
          >
            ₹{fmtINR(contributes)}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default function AffordabilityPage() {
  const { plans, loading, load, add, update, remove } = useAffordabilityStore()
  const { accounts, load: loadAccounts } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const isReadOnly = useIsReadOnly()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [newOpen, setNewOpen]     = useState(false)
  const [newName, setNewName]     = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [adding, setAdding]       = useState(false)
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  useEffect(() => { load(); loadAccounts() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const findAccount = (id: string) => accounts.find(a => a.id === id)
  const valueOf = (id: string) => {
    const a = findAccount(id)
    return a ? computeNetInr(a, usdInr, cadInr) : 0
  }
  const allocatedFor = (plan: AffordabilityPlan) =>
    plan.allocations.reduce((s, al) => s + valueOf(al.accountId) * al.percent / 100, 0)

  async function handleCreate() {
    const name = newName.trim()
    const target = parseFloat(newTarget)
    if (!name || isNaN(target)) return
    setAdding(true)
    const id = await add(name, target)
    setAdding(false)
    setNewOpen(false)
    setNewName(''); setNewTarget('')
    setExpanded(id)
  }

  async function handleDelete(plan: AffordabilityPlan) {
    const ok = await confirm({
      title: 'Delete plan',
      message: `Delete "${plan.name}"? This only removes the plan — your accounts are untouched.`,
    })
    if (ok) await remove(plan.id)
  }

  function setPercent(plan: AffordabilityPlan, accountId: string, percent: number) {
    update({
      ...plan,
      allocations: plan.allocations.map(a => a.accountId === accountId ? { ...a, percent } : a),
    })
  }

  function addAllocation(plan: AffordabilityPlan, accountId: string) {
    if (plan.allocations.some(a => a.accountId === accountId)) return
    update({ ...plan, allocations: [...plan.allocations, { accountId, percent: 100 }] })
    setPickerFor(null)
  }

  function removeAllocation(plan: AffordabilityPlan, accountId: string) {
    update({ ...plan, allocations: plan.allocations.filter(a => a.accountId !== accountId) })
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Affordability</Typography>
          <Typography variant="caption" color="text.secondary">
            Hypothetical funding plans. Allocating here never changes your actual balances.
          </Typography>
        </Box>
        {!isReadOnly && (
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setNewOpen(true)} sx={{ flexShrink: 0, ml: 2 }}>
            New Plan
          </Button>
        )}
      </Box>

      {plans.length === 0 && (
        <Paper elevation={0} sx={{ p: 5, textAlign: 'center', border: '1px solid var(--border-main)' }}>
          <Typography variant="body2" color="text.disabled">
            No plans yet. Create one to work out how you'd fund a purchase or clear a loan.
          </Typography>
        </Paper>
      )}

      {plans.map(plan => {
        const allocated = allocatedFor(plan)
        const remaining = plan.target - allocated
        const pct       = plan.target > 0 ? (allocated / plan.target) * 100 : 0
        const covered   = remaining <= 0
        const isOpen    = expanded === plan.id
        const unused    = accounts.filter(a => !plan.allocations.some(al => al.accountId === a.id))

        return (
          <Paper key={plan.id} elevation={0} sx={{ mb: 2, border: '1px solid var(--border-main)', overflow: 'hidden' }}>
            {/* Header */}
            <Box
              onClick={() => setExpanded(isOpen ? null : plan.id)}
              sx={{ px: 2, py: 1.75, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>
                  {plan.name}
                </Typography>
                <EditableAmount
                  value={plan.target}
                  isReadOnly={isReadOnly}
                  onCommit={v => update({ ...plan, target: v })}
                />
                {isOpen
                  ? <ExpandLessIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  : <ExpandMoreIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
              </Box>

              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, pct))}
                sx={{
                  height: 6, borderRadius: 3, mb: 0.75,
                  bgcolor: 'var(--surface-card)',
                  '& .MuiLinearProgress-bar': { bgcolor: covered ? 'success.main' : 'primary.main', borderRadius: 3 },
                }}
              />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Allocated <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>₹{fmtINR(allocated)}</Box>
                  {' · '}{pct.toFixed(1)}% of target
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: covered ? 'success.main' : 'error.main' }}>
                  {covered ? `Surplus ₹${fmtINR(-remaining)}` : `Short ₹${fmtINR(remaining)}`}
                </Typography>
              </Box>
            </Box>

            {/* Allocations */}
            <Collapse in={isOpen}>
              <Box>
                {plan.allocations.length === 0 && (
                  <Typography variant="body2" color="text.disabled" sx={{ px: 2, py: 2, borderTop: '1px solid var(--border-main)' }}>
                    No accounts allocated yet.
                  </Typography>
                )}

                {plan.allocations.map(alloc => (
                  <AllocationRow
                    key={alloc.accountId}
                    alloc={alloc}
                    account={findAccount(alloc.accountId)}
                    isReadOnly={isReadOnly}
                    onCommit={p => setPercent(plan, alloc.accountId, p)}
                    onRemove={() => removeAllocation(plan, alloc.accountId)}
                  />
                ))}

                {!isReadOnly && (
                  <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid var(--border-main)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {pickerFor === plan.id ? (
                      <FormControl size="small" sx={{ minWidth: 240 }}>
                        <InputLabel>Add account</InputLabel>
                        <Select
                          label="Add account"
                          value=""
                          open
                          onClose={() => setPickerFor(null)}
                          onChange={e => addAllocation(plan, e.target.value)}
                        >
                          {unused.length === 0 && <MenuItem disabled value="">All accounts allocated</MenuItem>}
                          {[...unused]
                            .sort((a, b) => computeNetInr(b, usdInr, cadInr) - computeNetInr(a, usdInr, cadInr))
                            .map(a => (
                              <MenuItem key={a.id} value={a.id}>
                                {a.name} — ₹{fmtINR(computeNetInr(a, usdInr, cadInr))}
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <Button size="small" startIcon={<AddIcon />} onClick={() => setPickerFor(plan.id)}>
                        Add account
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => handleDelete(plan)} sx={{ ml: 'auto' }}>
                      Delete plan
                    </Button>
                  </Box>
                )}
              </Box>
            </Collapse>
          </Paper>
        )
      })}

      {/* New plan dialog */}
      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>New Plan</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="What for?" size="small" fullWidth autoFocus
            placeholder="e.g. Buy a car, Clear HDFC loan"
            value={newName} onChange={e => setNewName(e.target.value)}
          />
          <TextField
            label="Target amount (₹)" size="small" fullWidth type="number"
            value={newTarget} onChange={e => setNewTarget(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewOpen(false)} color="inherit">Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={adding || !newName.trim() || isNaN(parseFloat(newTarget))}
          >
            {adding ? <CircularProgress size={16} color="inherit" /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
