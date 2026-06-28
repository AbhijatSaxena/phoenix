import { useEffect, useState } from 'react'
import {
  Box, Paper, Grid, Typography, Button, TextField, CircularProgress,
  Divider, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchSubaruCarConfig, saveSubaruCarConfig } from '../services/firebase'
import type { SubaruCarConfig, SubaruExpenditure } from '../types'
import { confirm } from '../components/ConfirmDialog'
import { fmtCurrency } from '../lib/fmt'

function fmtUSD(val: number) { return fmtCurrency(val, 'USD') }
import { useIsReadOnly } from '../store/authStore'

const DEFAULT_CONFIG: SubaruCarConfig = {
  estimatedSellingPrice: 0,
  expenditures: [],
}

function EditableRow({ label, value, onCommit, isReadOnly }: {
  label: string
  value: number
  onCommit: (v: number) => void
  isReadOnly: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  function start() { setVal(String(value)); setEditing(true) }
  function commit() {
    const n = parseFloat(val)
    if (!isNaN(n)) onCommit(n)
    setEditing(false)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {editing ? (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" type="number" value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
            slotProps={{ htmlInput: { style: { textAlign: 'right', width: 140 } } }} autoFocus />
          <Button size="small" variant="contained" onClick={commit} sx={{ minWidth: 0, px: 1.5 }}>OK</Button>
        </Box>
      ) : isReadOnly ? (
        <Typography variant="body2">{fmtUSD(value)}</Typography>
      ) : (
        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={start}>
          {fmtUSD(value)}
        </Typography>
      )}
    </Box>
  )
}

export default function SubaruCarPage() {
  const [config, setConfig] = useState<SubaruCarConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddExp, setShowAddExp] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')

  const isReadOnly = useIsReadOnly()

  useEffect(() => {
    fetchSubaruCarConfig().then(cfg => {
      setConfig((cfg as SubaruCarConfig) ?? DEFAULT_CONFIG)
      setLoading(false)
    })
  }, [])

  if (loading || !config) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
        <CircularProgress />
      </Box>
    )
  }

  const totalExp = config.expenditures.reduce((s, e) => s + e.amount, 0)
  const netValue = config.estimatedSellingPrice - totalExp
  const netColor = netValue >= 0 ? 'success.main' : 'error.main'

  async function persist(updated: SubaruCarConfig) {
    setConfig(updated)
    await saveSubaruCarConfig(updated as unknown as Record<string, unknown>)
  }

  async function addExpenditure() {
    if (!config) return
    const amt = parseFloat(newAmount)
    if (!newLabel.trim() || isNaN(amt)) return
    const exp: SubaruExpenditure = { label: newLabel.trim(), amount: amt }
    await persist({ ...config, expenditures: [...config.expenditures, exp] })
    setNewLabel('')
    setNewAmount('')
    setShowAddExp(false)
  }

  async function removeExpenditure(idx: number) {
    if (!config) return
    const exp = config.expenditures[idx]
    const ok = await confirm({ title: 'Remove expenditure', message: `Remove "${exp.label}" (${fmtUSD(exp.amount)})?` })
    if (!ok) return
    await persist({ ...config, expenditures: config.expenditures.filter((_, i) => i !== idx) })
  }

  async function commitEdit(idx: number) {
    if (!config) return
    const amt = parseFloat(editAmount)
    if (!editLabel.trim() || isNaN(amt)) { setEditIdx(null); return }
    const expenditures = config.expenditures.map((e, i) =>
      i === idx ? { label: editLabel.trim(), amount: amt } : e
    )
    await persist({ ...config, expenditures })
    setEditIdx(null)
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Subaru Car</Typography>

      <Grid container spacing={2.5}>
        {/* Left: selling price + summary */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937', mb: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Valuation</Typography>
            <EditableRow
              label="Estimated Selling Price"
              value={config.estimatedSellingPrice}
              onCommit={v => persist({ ...config, estimatedSellingPrice: v })}
              isReadOnly={isReadOnly}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
              <Typography variant="body2" color="text.secondary">Total Expenditures</Typography>
              <Typography variant="body2">{fmtUSD(totalExp)}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Net Value</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: netColor }}>{fmtUSD(netValue)}</Typography>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>Summary</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Estimated Selling Price</Typography>
              <Typography variant="body2">{fmtUSD(config.estimatedSellingPrice)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Total Expenditures</Typography>
              <Typography variant="body2">{fmtUSD(totalExp)}</Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Net Proceeds</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: netColor }}>{fmtUSD(netValue)}</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Right: expenditures list */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Expenditures</Typography>
              {!isReadOnly && (
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setShowAddExp(v => !v)}>
                  Add
                </Button>
              )}
            </Box>

            {showAddExp && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Label"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  sx={{ flex: 1, minWidth: 120 }}
                />
                <TextField
                  size="small"
                  type="number"
                  placeholder="Amount"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addExpenditure()}
                  sx={{ width: 130 }}
                />
                <Button variant="contained" size="small" onClick={addExpenditure}>
                  Add
                </Button>
              </Box>
            )}

            <Box>
              {config.expenditures.map((exp, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.25,
                    borderBottom: '1px solid #1f2937',
                    '&:hover .del-btn': { opacity: 1 },
                  }}
                >
                  {!isReadOnly && editIdx === idx ? (
                    <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
                      <TextField
                        size="small"
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        sx={{ flex: 1 }}
                        autoFocus
                      />
                      <TextField
                        size="small"
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(idx); if (e.key === 'Escape') setEditIdx(null) }}
                        sx={{ width: 110 }}
                      />
                      <Button size="small" variant="contained" onClick={() => commitEdit(idx)} sx={{ minWidth: 0, px: 1.5 }}>OK</Button>
                    </Box>
                  ) : (
                    <>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        noWrap
                        sx={{ maxWidth: 180, cursor: isReadOnly ? 'default' : 'pointer' }}
                        onClick={() => !isReadOnly && (setEditIdx(idx), setEditLabel(exp.label), setEditAmount(String(exp.amount)))}
                      >
                        {exp.label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography
                          variant="body2"
                          sx={{ cursor: isReadOnly ? 'default' : 'pointer', '&:hover': isReadOnly ? {} : { textDecoration: 'underline' } }}
                          onClick={() => !isReadOnly && (setEditIdx(idx), setEditLabel(exp.label), setEditAmount(String(exp.amount)))}
                        >
                          {fmtUSD(exp.amount)}
                        </Typography>
                        {!isReadOnly && (
                          <IconButton
                            className="del-btn"
                            size="small"
                            onClick={() => removeExpenditure(idx)}
                            sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'error.main', p: 0.25 }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </>
                  )}
                </Box>
              ))}
              {config.expenditures.length === 0 && (
                <Typography variant="body2" color="text.disabled" sx={{ py: 1.5 }}>
                  No expenditures yet.
                </Typography>
              )}
            </Box>

            {config.expenditures.length > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: '1px solid #374151', mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Total</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{fmtUSD(totalExp)}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
