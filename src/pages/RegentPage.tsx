import { useEffect, useState } from 'react'
import {
  Box, Paper, Grid, Typography, Button, TextField, CircularProgress,
  Divider, IconButton, Checkbox, Tooltip,
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
  principalOutstanding: 13719750,
  bulkPayments: [],
  tdsPayments: [],
  includeRefund: false,
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

function PaymentList({
  title, payments, isReadOnly,
  onAdd, onRemove, onEditCommit,
}: {
  title: string
  payments: { date: string; amount: number }[]
  isReadOnly: boolean
  onAdd: (date: string, amount: number) => Promise<void>
  onRemove: (i: number) => Promise<void>
  onEditCommit: (i: number, amount: number) => Promise<void>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editVal, setEditVal] = useState('')

  async function handleAdd() {
    const amt = parseFloat(newAmount)
    if (!newDate || isNaN(amt)) return
    await onAdd(newDate, amt)
    setNewDate(''); setNewAmount(''); setShowAdd(false)
  }

  async function handleCommit(i: number) {
    const val = parseFloat(editVal)
    if (!isNaN(val)) await onEditCommit(i, val)
    setEditIdx(null)
  }

  const total = payments.reduce((s, p) => s + p.amount, 0)
  const sorted = [...payments].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
        {!isReadOnly && (
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setShowAdd(v => !v)}>
            Add
          </Button>
        )}
      </Box>

      {showAdd && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1, minWidth: 130 }} />
          <TextField size="small" type="number" placeholder="Amount (₹)" value={newAmount}
            onChange={e => setNewAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            sx={{ width: 130 }} />
          <Button variant="contained" size="small" onClick={handleAdd}>Add</Button>
        </Box>
      )}

      <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
        {sorted.map((p, i) => {
          const origIdx = payments.indexOf(p)
          return (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937', '&:hover .del-btn': { opacity: 1 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>{isoToDisplay(p.date)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {!isReadOnly && editIdx === origIdx ? (
                  <TextField size="small" type="number" value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCommit(origIdx); if (e.key === 'Escape') setEditIdx(null) }}
                    onBlur={() => handleCommit(origIdx)}
                    slotProps={{ htmlInput: { style: { width: 100 } } }} autoFocus />
                ) : (
                  <Typography variant="body2"
                    onClick={() => !isReadOnly && (setEditIdx(origIdx), setEditVal(String(p.amount)))}
                    sx={{ cursor: isReadOnly ? 'default' : 'pointer', '&:hover': isReadOnly ? {} : { textDecoration: 'underline' } }}>
                    ₹{fmtINR(p.amount)}
                  </Typography>
                )}
                {!isReadOnly && (
                  <IconButton className="del-btn" size="small" onClick={() => onRemove(origIdx)}
                    sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'error.main', p: 0.25 }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          )
        })}
        {payments.length === 0 && <Typography variant="body2" color="text.disabled" sx={{ py: 1.5 }}>No entries yet.</Typography>}
      </Box>

      {payments.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.25, borderTop: '1px solid #374151', mt: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Total</Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>₹{fmtINR(total)}</Typography>
        </Box>
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
  const iGetToKeep = (config.includeRefund ? refunded : withGst) - config.principalOutstanding

  const bulkSum         = config.bulkPayments.reduce((s, p) => s + p.amount, 0)
  const tdsSum          = config.tdsPayments.reduce((s, p) => s + p.amount, 0)
  const emiSum          = emis.reduce((s, e) => s + e.amount, 0)
  const totalFromPocket = bulkSum + tdsSum + emiSum
  const profitLoss      = iGetToKeep - totalFromPocket
  const profitLossPct   = (profitLoss / totalFromPocket) * 100

  async function persist(updated: RegentConfig) {
    setConfig(updated)
    await saveRegentConfig(updated as unknown as Record<string, unknown>)
  }

  // ── Bulk payments ──
  async function addBulk(date: string, amount: number) {
    const bulkPayments = [...config!.bulkPayments, { date, amount }]
    await persist({ ...config!, bulkPayments })
  }
  async function removeBulk(i: number) {
    const p = config!.bulkPayments[i]
    const ok = await confirm({ title: 'Remove payment', message: `Remove ₹${fmtINR(p.amount)} on ${isoToDisplay(p.date)}?` })
    if (!ok) return
    await persist({ ...config!, bulkPayments: config!.bulkPayments.filter((_, idx) => idx !== i) })
  }
  async function editBulk(i: number, amount: number) {
    const bulkPayments = config!.bulkPayments.map((p, idx) => idx === i ? { ...p, amount } : p)
    await persist({ ...config!, bulkPayments })
  }

  // ── TDS payments ──
  async function addTds(date: string, amount: number) {
    const tdsPayments = [...config!.tdsPayments, { date, amount }]
    await persist({ ...config!, tdsPayments })
  }
  async function removeTds(i: number) {
    const p = config!.tdsPayments[i]
    const ok = await confirm({ title: 'Remove TDS entry', message: `Remove ₹${fmtINR(p.amount)} on ${isoToDisplay(p.date)}?` })
    if (!ok) return
    await persist({ ...config!, tdsPayments: config!.tdsPayments.filter((_, idx) => idx !== i) })
  }
  async function editTds(i: number, amount: number) {
    const tdsPayments = config!.tdsPayments.map((p, idx) => idx === i ? { ...p, amount } : p)
    await persist({ ...config!, tdsPayments })
  }

  // ── EMI ──
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
    const ok = await confirm({ title: 'Remove EMI entry', message: `Remove EMI of ₹${emi?.amount.toLocaleString()} on ${emi?.date}?` })
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
        {/* Cost Breakdown */}
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
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #1f2937' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {!isReadOnly && (
                  <Tooltip title={config.includeRefund ? 'Applied to dashboard value' : 'Not applied to dashboard value'} placement="top">
                    <Checkbox size="small" checked={!!config.includeRefund}
                      onChange={e => persist({ ...config, includeRefund: e.target.checked })} sx={{ p: 0.25 }} />
                  </Tooltip>
                )}
                <Typography variant="body2" color={config.includeRefund ? 'text.secondary' : 'text.disabled'}>
                  Refunded if cancelled (-20%)
                </Typography>
              </Box>
              <Typography variant="body2" color={config.includeRefund ? 'text.primary' : 'text.disabled'}>
                ₹{fmtINR(refunded)}
              </Typography>
            </Box>
            <EditableRow label="Principal Outstanding" value={config.principalOutstanding} onCommit={v => persist({ ...config, principalOutstanding: v })} isReadOnly={isReadOnly} />
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>I get to keep</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: keepColor }}>₹{fmtINR(iGetToKeep)}</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Payment Summary + P&L */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937', mb: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Payment Summary</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
              <Typography variant="body2" color="text.secondary">Total Bulk Paid</Typography>
              <Typography variant="body2">₹{fmtINR(bulkSum)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
              <Typography variant="body2" color="text.secondary">Total TDS Paid</Typography>
              <Typography variant="body2">₹{fmtINR(tdsSum)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937' }}>
              <Typography variant="body2" color="text.secondary">Total EMI Paid</Typography>
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

      {/* 3-column payment tracking */}
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #1f2937', mt: 2.5 }}>
        <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
          {/* Bulk Payments */}
          <Grid size={{ xs: 12, md: 4 }}>
            <PaymentList
              title="Bulk Payments"
              payments={config.bulkPayments}
              isReadOnly={isReadOnly}
              onAdd={addBulk}
              onRemove={removeBulk}
              onEditCommit={editBulk}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }} sx={{ borderLeft: { md: '1px solid #1f2937' }, pl: { md: 3 } }}>
            <PaymentList
              title="TDS Payments"
              payments={config.tdsPayments}
              isReadOnly={isReadOnly}
              onAdd={addTds}
              onRemove={removeTds}
              onEditCommit={editTds}
            />
          </Grid>

          {/* EMI Schedule */}
          <Grid size={{ xs: 12, md: 4 }} sx={{ borderLeft: { md: '1px solid #1f2937' }, pl: { md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Home Loan EMIs</Typography>
              {!isReadOnly && (
                <Button size="small" variant="outlined" startIcon={<AddIcon />}
                  onClick={() => { if (!showAddEmi && emis.length > 0) resetEmi({ date: '', amount: emis[0].amount }); setShowAddEmi(v => !v) }}>
                  Add
                </Button>
              )}
            </Box>

            {showAddEmi && (
              <Box component="form" onSubmit={handleEmi(onAddEmi)} sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <TextField size="small" type="date" {...regEmi('date', { required: true })} sx={{ flex: 1, minWidth: 130 }} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" type="number" placeholder="Amount" {...regEmi('amount', { required: true, valueAsNumber: true })} sx={{ width: 130 }} />
                <Button type="submit" variant="contained" size="small" disabled={emiLoading}>
                  {emiLoading ? '…' : 'Add'}
                </Button>
              </Box>
            )}

            <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
              {emis.map(emi => (
                <Box key={emi.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #1f2937', '&:hover .delete-emi': { opacity: 1 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>{isoToDisplay(emi.date)}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {!isReadOnly && editEmiId === emi.id ? (
                      <TextField size="small" type="number" value={editEmiValue}
                        onChange={e => setEditEmiValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEmiEdit(); if (e.key === 'Escape') setEditEmiId(null) }}
                        onBlur={commitEmiEdit}
                        slotProps={{ htmlInput: { style: { width: 100 } } }} autoFocus />
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.25, borderTop: '1px solid #374151', mt: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Total</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>₹{fmtINR(emiSum)}</Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}
