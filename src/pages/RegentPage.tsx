import { useEffect, useState } from 'react'
import {
  Box, Paper, Grid, Typography, Button, TextField, CircularProgress,
  Divider, IconButton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  fetchRegentConfig, saveRegentConfig,
  fetchRegentEmis, addRegentEmi, deleteRegentEmi, updateRegentEmi,
} from '../services/firebase'
import type { RegentConfig, RegentEmi } from '../types'
import { confirm } from '../components/ConfirmDialog'
import { fmtINR, isoToDisplay } from '../lib/fmt'
import { useIsReadOnly } from '../store/authStore'
import { useForm } from 'react-hook-form'

const DEFAULT_CONFIG: RegentConfig = {
  sqft: 2191,
  baseRate: 8999,
  floorRisePremium: 482020,
  premiumLocation: 1095500,
  carParking: 700000,
  infraCharges: 657300,
  clubHouseCharges: 300000,
  principalOutstanding: 13746729,
  payments: [
    { label: 'Down Payment 2024',   amount: 4500502 },
    { label: 'July 2025 Bulk',      amount: 1125127 },
    { label: 'October 2025 Bulk',   amount: 887689  },
    { label: 'April 2026 Bulk',     amount: 687690  },
    { label: 'Total TDS Till date', amount: 189324  },
  ],
  totalTds: 189324,
}

interface EmiForm { date: string; amount: number }

function EditableRow({ label, value, onCommit, isReadOnly }: { label: string; value: number; onCommit: (v: number) => void; isReadOnly: boolean }) {
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
            slotProps={{ htmlInput: { style: { textAlign: 'right', width: 120 } } }} autoFocus />
          <Button size="small" variant="contained" onClick={commit} sx={{ minWidth: 0, px: 1.5 }}>OK</Button>
        </Box>
      ) : isReadOnly ? (
        <Typography variant="body2">₹{fmtINR(value)}</Typography>
      ) : (
        <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={start}>
          ₹{fmtINR(value)}
        </Typography>
      )}
    </Box>
  )
}

export default function RegentPage() {
  const [config, setConfig] = useState<RegentConfig | null>(null)
  const [emis, setEmis] = useState<RegentEmi[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddEmi, setShowAddEmi] = useState(false)
  const [emiLoading, setEmiLoading] = useState(false)
  const [editEmiId, setEditEmiId] = useState<string | null>(null)
  const [editEmiValue, setEditEmiValue] = useState('')
  const [editPaymentIndex, setEditPaymentIndex] = useState<number | null>(null)
  const [editPaymentValue, setEditPaymentValue] = useState('')

  const { register: regEmi, handleSubmit: handleEmi, reset: resetEmi } = useForm<EmiForm>()
  const isReadOnly = useIsReadOnly()

  useEffect(() => {
    async function load() {
      const [cfg, emirows] = await Promise.all([fetchRegentConfig(), fetchRegentEmis()])
      setConfig((cfg as RegentConfig) ?? DEFAULT_CONFIG)
      setEmis((emirows as RegentEmi[]).sort((a, b) => b.date.localeCompare(a.date)))
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !config) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}><CircularProgress /></Box>

  const baseTotal  = config.sqft * config.baseRate
  const totalCost  = baseTotal + config.floorRisePremium + config.premiumLocation + config.carParking + config.infraCharges + config.clubHouseCharges
  const withGst    = totalCost * 1.05
  const refunded   = withGst * 0.80
  const iGetToKeep = refunded - config.principalOutstanding

  const emiSum          = emis.reduce((s, e) => s + e.amount, 0)
  const paymentSum      = config.payments.reduce((s, p) => s + p.amount, 0)
  const totalFromPocket = paymentSum + emiSum
  const profitLoss      = iGetToKeep - totalFromPocket
  const profitLossPct   = (profitLoss / totalFromPocket) * 100

  async function persist(updated: RegentConfig) {
    setConfig(updated)
    await saveRegentConfig(updated as unknown as Record<string, unknown>)
  }

  async function commitPayment(i: number) {
    const val = parseFloat(editPaymentValue)
    if (!isNaN(val)) {
      const payments = config!.payments.map((p, idx) => idx === i ? { ...p, amount: val } : p)
      await persist({ ...config!, payments })
    }
    setEditPaymentIndex(null)
  }

  async function onAddEmi(data: EmiForm) {
    setEmiLoading(true)
    const ref = await addRegentEmi({ date: data.date, amount: Number(data.amount) })
    setEmis(prev => [...prev, { id: ref.id, date: data.date, amount: Number(data.amount) }].sort((a, b) => b.date.localeCompare(a.date)))
    resetEmi()
    setShowAddEmi(false)
    setEmiLoading(false)
  }

  async function commitEmiEdit() {
    if (!editEmiId) return
    const val = parseFloat(editEmiValue)
    if (!isNaN(val)) {
      const emi = emis.find(e => e.id === editEmiId)!
      await updateRegentEmi(editEmiId, { date: emi.date, amount: val })
      setEmis(prev => prev.map(e => e.id === editEmiId ? { ...e, amount: val } : e))
    }
    setEditEmiId(null)
  }

  async function removeEmi(id: string) {
    const emi = emis.find(e => e.id === id)
    const ok = await confirm({ title: 'Remove EMI entry', message: `Remove the EMI of ₹${emi?.amount.toLocaleString()} on ${emi?.date}?` })
    if (!ok) return
    await deleteRegentEmi(id)
    setEmis(prev => prev.filter(e => e.id !== id))
  }

  const pnlColor  = profitLoss >= 0 ? 'success.main' : 'error.main'
  const keepColor = iGetToKeep >= 0 ? 'success.main' : 'error.main'

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>Regent Property</Typography>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Cost Breakdown</Typography>
            <EditableRow label="Area (sqft)" value={config.sqft} onCommit={v => persist({ ...config, sqft: v })} isReadOnly={isReadOnly} />
            <EditableRow label="Base Rate (₹/sqft)" value={config.baseRate} onCommit={v => persist({ ...config, baseRate: v })} isReadOnly={isReadOnly} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
              <Typography variant="body2" color="text.secondary">Base Price</Typography>
              <Typography variant="body2">₹{fmtINR(baseTotal)}</Typography>
            </Box>
            <EditableRow label="Floor Rise Premium" value={config.floorRisePremium} onCommit={v => persist({ ...config, floorRisePremium: v })} isReadOnly={isReadOnly} />
            <EditableRow label="Premium Location" value={config.premiumLocation} onCommit={v => persist({ ...config, premiumLocation: v })} isReadOnly={isReadOnly} />
            <EditableRow label="Car Parking" value={config.carParking} onCommit={v => persist({ ...config, carParking: v })} isReadOnly={isReadOnly} />
            <EditableRow label="Infra Charges" value={config.infraCharges} onCommit={v => persist({ ...config, infraCharges: v })} isReadOnly={isReadOnly} />
            <EditableRow label="Club House Charges" value={config.clubHouseCharges} onCommit={v => persist({ ...config, clubHouseCharges: v })} isReadOnly={isReadOnly} />
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Total</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>₹{fmtINR(totalCost)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography variant="body2" color="text.secondary">Saleable Value (+5% GST)</Typography>
              <Typography variant="body2">₹{fmtINR(withGst)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography variant="body2" color="text.secondary">Refunded if cancelled (-20%)</Typography>
              <Typography variant="body2">₹{fmtINR(refunded)}</Typography>
            </Box>
            <EditableRow label="Principal Outstanding" value={config.principalOutstanding} onCommit={v => persist({ ...config, principalOutstanding: v })} isReadOnly={isReadOnly} />
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>I get to keep</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: keepColor }}>₹{fmtINR(iGetToKeep)}</Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937', mb: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Payments Made</Typography>
            {config.payments.map((p, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.25, borderBottom: '1px solid #1f2937' }}>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 160 }}>{p.label}</Typography>
                {!isReadOnly && editPaymentIndex === i ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" type="number" value={editPaymentValue} onChange={e => setEditPaymentValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && commitPayment(i)} slotProps={{ htmlInput: { style: { width: 110 } } }} autoFocus />
                    <Button size="small" variant="contained" onClick={() => commitPayment(i)} sx={{ minWidth: 0, px: 1.5 }}>OK</Button>
                  </Box>
                ) : isReadOnly ? (
                  <Typography variant="body2">₹{fmtINR(p.amount)}</Typography>
                ) : (
                  <Typography variant="body2" sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => { setEditPaymentIndex(i); setEditPaymentValue(String(p.amount)) }}>
                    ₹{fmtINR(p.amount)}
                  </Typography>
                )}
              </Box>
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
              <Typography variant="body2" color="text.secondary">Home Loan EMIs (sum)</Typography>
              <Typography variant="body2">₹{fmtINR(emiSum)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Total From Pocket</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>₹{fmtINR(totalFromPocket)}</Typography>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Profit / Loss</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">I get to keep</Typography>
              <Typography variant="body2">₹{fmtINR(iGetToKeep)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">Total From Pocket</Typography>
              <Typography variant="body2">₹{fmtINR(totalFromPocket)}</Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>P/L Amount</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: pnlColor }}>₹{fmtINR(profitLoss)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>P/L %</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: pnlColor }}>{profitLossPct.toFixed(2)}%</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937', mt: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Home Loan EMI Schedule</Typography>
          {!isReadOnly && (
            <Button size="small" variant="outlined" startIcon={<AddIcon />}
              onClick={() => { if (!showAddEmi && emis.length > 0) resetEmi({ date: '', amount: emis[0].amount }); setShowAddEmi(v => !v) }}>
              Add EMI
            </Button>
          )}
        </Box>

        {showAddEmi && (
          <Box component="form" onSubmit={handleEmi(onAddEmi)} sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
            <TextField size="small" type="date" {...regEmi('date', { required: true })} sx={{ flex: 1 }} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField size="small" type="number" placeholder="Amount" {...regEmi('amount', { required: true, valueAsNumber: true })} sx={{ width: 140 }} />
            <Button type="submit" variant="contained" size="small" disabled={emiLoading}>
              {emiLoading ? '…' : 'Add'}
            </Button>
          </Box>
        )}

        <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
          {emis.map(emi => (
            <Box key={emi.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937', '&:hover .delete-emi': { opacity: 1 } }}>
              <Typography variant="body2" color="text.secondary">{isoToDisplay(emi.date)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {!isReadOnly && editEmiId === emi.id ? (
                  <TextField size="small" type="number" value={editEmiValue}
                    onChange={e => setEditEmiValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEmiEdit(); if (e.key === 'Escape') setEditEmiId(null) }}
                    onBlur={commitEmiEdit}
                    slotProps={{ htmlInput: { style: { width: 110 } } }} autoFocus />
                ) : (
                  <Typography variant="body2"
                    onClick={() => !isReadOnly && (setEditEmiId(emi.id), setEditEmiValue(String(emi.amount)))}
                    sx={{ cursor: isReadOnly ? 'default' : 'pointer', '&:hover': isReadOnly ? {} : { textDecoration: 'underline' } }}>
                    ₹{fmtINR(emi.amount)}
                  </Typography>
                )}
                {!isReadOnly && (
                  <IconButton className="delete-emi" size="small" onClick={() => removeEmi(emi.id)}
                    sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'error.main', p: 0.25 }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          ))}
          {emis.length === 0 && <Typography variant="body2" color="text.disabled" sx={{ py: 1.5 }}>No EMI entries yet.</Typography>}
        </Box>

        {emis.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: '1px solid #374151', mt: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>EMI Total</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>₹{fmtINR(emiSum)}</Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
