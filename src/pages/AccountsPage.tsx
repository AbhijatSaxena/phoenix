import { useEffect, useState } from 'react'
import {
  Box, Paper, Typography, Collapse, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import AddIcon from '@mui/icons-material/Add'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import type { Account, Category } from '../types'
import { fmtINR, fmtCurrency } from '../lib/fmt'
import { confirm } from '../components/ConfirmDialog'
import { useForm } from 'react-hook-form'
import { useIsReadOnly } from '../store/authStore'

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)   return 'just now'
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  < 7)   return `${days}d ago`
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'liquid',       label: 'Liquid',              color: '#38bdf8' },
  { key: 'appreciating', label: 'Appreciating Assets', color: '#34d399' },
  { key: 'investments',  label: 'Investments',          color: '#a78bfa' },
  { key: 'depreciating', label: 'Depreciating Assets', color: '#fbbf24' },
]

interface EditForm { usd: number; cad: number; inr: number }

export default function AccountsPage() {
  const { accounts, loading, load, update, remove, add } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const isReadOnly = useIsReadOnly()

  const [editing, setEditing] = useState<Account | null>(null)
  const [editCategory, setEditCategory] = useState<Category>('liquid')
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({
    liquid: false, appreciating: false, investments: false, depreciating: false,
  })
  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCategory, setAddCategory] = useState<Category>('investments')
  const [addInsertAfter, setAddInsertAfter] = useState<string>('end')
  const [addUsd, setAddUsd] = useState('')
  const [addCad, setAddCad] = useState('')
  const [addInr, setAddInr] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  const { register, handleSubmit, reset } = useForm<EditForm>()

  useEffect(() => { load() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const byCategory = (cat: Category) => accounts.filter(a => a.category === cat)
  const sectionTotal = (cat: Category) =>
    byCategory(cat).reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  function computeNewOrder(category: Category, afterId: string): number {
    const cat = byCategory(category)
    if (cat.length === 0) return Math.max(0, ...accounts.map(a => a.order)) + 1
    if (afterId === 'beginning') return cat[0].order - 0.5
    if (afterId === 'end') return cat[cat.length - 1].order + 1
    const idx = cat.findIndex(a => a.id === afterId)
    if (idx < 0 || idx === cat.length - 1) return cat[cat.length - 1].order + 1
    return (cat[idx].order + cat[idx + 1].order) / 2
  }

  async function handleAddAccount() {
    const name = addName.trim()
    if (!name) return
    setAddSaving(true)
    const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now().toString(36)
    const order = computeNewOrder(addCategory, addInsertAfter)
    await add({ id, name, category: addCategory, usd: Number(addUsd) || 0, cad: Number(addCad) || 0, inr: Number(addInr) || 0, order, updatedAt: Date.now() })
    setAddSaving(false)
    setAddOpen(false)
    setAddName(''); setAddUsd(''); setAddCad(''); setAddInr('')
    setAddCategory('investments'); setAddInsertAfter('end')
  }

  function openEdit(account: Account) {
    if (isReadOnly) return
    setEditing(account)
    setEditCategory(account.category)
    reset({ usd: account.usd, cad: account.cad, inr: account.inr })
  }

  async function handleDeleteAccount() {
    if (!editing) return
    const net = computeNetInr(editing, usdInr, cadInr)
    const ok = await confirm({
      title: 'Delete account',
      message: `Permanently delete "${editing.name}" (₹${fmtINR(net)})? This cannot be undone. Past snapshots keep their own copy and won't be affected.`,
    })
    if (!ok) return
    await remove(editing.id)
    setEditing(null)
  }

  async function onSubmitEdit(data: EditForm) {
    if (!editing) return
    const isDerived = !!editing.derived
    await update({
      ...editing,
      category: editCategory,
      ...(isDerived ? {} : {
        usd: isNaN(Number(data.usd)) ? 0 : Number(data.usd),
        cad: isNaN(Number(data.cad)) ? 0 : Number(data.cad),
        inr: isNaN(Number(data.inr)) ? 0 : Number(data.inr),
      }),
    })
    setEditing(null)
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Accounts</Typography>
        {!isReadOnly && (
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add Account
          </Button>
        )}
      </Box>

      {CATEGORIES.map(({ key, label, color }) => (
        <Paper key={key} elevation={0} sx={{ mb: 2, border: '1px solid var(--border-main)', overflow: 'hidden' }}>
          <Box
            component="button"
            onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
            sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color }}>{label}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">₹{fmtINR(sectionTotal(key))}</Typography>
              {collapsed[key]
                ? <ExpandMoreIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                : <ExpandLessIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
            </Box>
          </Box>

          <Collapse in={!collapsed[key]}>
            <Box sx={{ borderTop: '1px solid var(--border-main)' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: '5fr 2fr 2fr 1fr 2fr' }, px: 2, py: 1, bgcolor: 'var(--surface-card)' }}>
                <Typography variant="caption" color="text.disabled">Account</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>USD</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>CAD</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>INR</Typography>
                <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'right' }}>NET (INR)</Typography>
              </Box>

              {byCategory(key).map(account => {
                const net = computeNetInr(account, usdInr, cadInr)
                return (
                  <Box
                    key={account.id}
                    onClick={() => openEdit(account)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr auto', sm: '5fr 2fr 2fr 1fr 2fr' },
                      px: 2, py: 1,
                      borderTop: '1px solid var(--border-main)',
                      cursor: isReadOnly ? 'default' : 'pointer',
                      '&:hover': isReadOnly ? {} : { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" noWrap sx={{ color: 'text.primary', maxWidth: 200 }}>
                          {account.name}
                        </Typography>
                        {account.derived && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', border: '1px solid var(--border-subtle)', px: 0.5, borderRadius: 0.5, fontSize: 10 }}>
                            {account.derived}
                          </Typography>
                        )}
                      </Box>
                      {account.updatedAt && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>{timeAgo(account.updatedAt)}</Typography>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', alignSelf: 'center' }}>
                      {account.usd !== 0 ? fmtCurrency(account.usd, 'USD') : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', alignSelf: 'center' }}>
                      {account.cad !== 0 ? fmtCurrency(account.cad, 'CAD') : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', alignSelf: 'center' }}>
                      {account.inr !== 0 ? `₹${fmtINR(account.inr)}` : '—'}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 500, textAlign: 'right', alignSelf: 'center', color: net < 0 ? 'error.main' : 'text.primary' }}
                    >
                      ₹{fmtINR(net)}
                    </Typography>
                  </Box>
                )
              })}
              {byCategory(key).length === 0 && (
                <Typography variant="body2" color="text.disabled" sx={{ px: 2, py: 1.5 }}>No accounts</Typography>
              )}
            </Box>
          </Collapse>
        </Paper>
      ))}

      {/* Add Account dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Add Account</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Account Name" size="small" fullWidth autoFocus value={addName} onChange={e => setAddName(e.target.value)} />
          <FormControl size="small" fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={addCategory} label="Category" onChange={e => { setAddCategory(e.target.value as Category); setAddInsertAfter('end') }}>
              {CATEGORIES.map(c => <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Insert after</InputLabel>
            <Select value={addInsertAfter} label="Insert after" onChange={e => setAddInsertAfter(e.target.value)}>
              <MenuItem value="beginning"><em>— Beginning of section —</em></MenuItem>
              {byCategory(addCategory).map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              <MenuItem value="end"><em>— End of section —</em></MenuItem>
            </Select>
          </FormControl>
          {(['usd', 'cad', 'inr'] as const).map(field => (
            <TextField
              key={field}
              label={`${field.toUpperCase()} Amount`}
              type="number"
              size="small"
              fullWidth
              slotProps={{ htmlInput: { step: 'any' } }}
              value={field === 'usd' ? addUsd : field === 'cad' ? addCad : addInr}
              onChange={e => { if (field === 'usd') setAddUsd(e.target.value); else if (field === 'cad') setAddCad(e.target.value); else setAddInr(e.target.value) }}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleAddAccount} variant="contained" disabled={addSaving || !addName.trim()}>
            {addSaving ? <CircularProgress size={16} color="inherit" /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Edit: {editing?.name}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmitEdit)}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={editCategory}
                label="Category"
                onChange={e => setEditCategory(e.target.value as Category)}
              >
                {CATEGORIES.map(c => (
                  <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {editing?.derived ? (
              <Typography variant="caption" color="text.secondary">
                Values are computed automatically from {editing.derived} data.
              </Typography>
            ) : (
              (['usd', 'cad', 'inr'] as const).map(field => (
                <TextField
                  key={field}
                  label={`${field.toUpperCase()} Amount`}
                  type="number"
                  slotProps={{ htmlInput: { step: 'any' } }}
                  size="small"
                  fullWidth
                  {...register(field, { valueAsNumber: true })}
                />
              ))
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button color="error" onClick={handleDeleteAccount} sx={{ mr: 'auto' }}>
              Delete
            </Button>
            <Button onClick={() => setEditing(null)} color="inherit">Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  )
}
