import { useEffect, useState } from 'react'
import {
  fetchRegentConfig, saveRegentConfig,
  fetchRegentEmis, addRegentEmi, deleteRegentEmi, updateRegentEmi,
} from '../services/firebase'
import type { RegentConfig, RegentEmi } from '../types'
import { confirm } from '../components/ConfirmDialog'
import { fmtINR, isoToDisplay } from '../lib/fmt'
import { useIsReadOnly } from '../store/authStore'
import Tooltip from '../components/Tooltip'
import Spinner from '../components/Spinner'
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
    { label: 'Down Payment 2024',     amount: 4500502 },
    { label: 'July 2025 Bulk',        amount: 1125127 },
    { label: 'October 2025 Bulk',     amount: 887689  },
    { label: 'April 2026 Bulk',       amount: 687690  },
    { label: 'Total TDS Till date',   amount: 189324  },
  ],
  totalTds: 189324,
}

interface EmiForm { date: string; amount: number }

export default function RegentPage() {
  const [config, setConfig] = useState<RegentConfig | null>(null)
  const [emis, setEmis] = useState<RegentEmi[]>([])
  const [loading, setLoading] = useState(true)
  const [editField, setEditField] = useState<keyof RegentConfig | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editPaymentIndex, setEditPaymentIndex] = useState<number | null>(null)
  const [editPaymentValue, setEditPaymentValue] = useState('')
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

  if (loading || !config) return <div className="flex items-center justify-center h-64"><Spinner /></div>

  // Derived calculations
  const baseTotal  = config.sqft * config.baseRate
  const totalCost  = baseTotal + config.floorRisePremium + config.premiumLocation
                   + config.carParking + config.infraCharges + config.clubHouseCharges
  const withGst    = totalCost * 1.05
  const refunded   = withGst * 0.80
  const iGetToKeep = refunded - config.principalOutstanding

  const emiSum     = emis.reduce((s, e) => s + e.amount, 0)
  const paymentSum = config.payments.reduce((s, p) => s + p.amount, 0)
  const totalFromPocket = paymentSum + emiSum

  const profitLoss    = iGetToKeep - totalFromPocket
  const profitLossPct = (profitLoss / totalFromPocket) * 100

  async function persist(updated: RegentConfig) {
    setConfig(updated)
    await saveRegentConfig(updated as unknown as Record<string, unknown>)
  }

  async function startEditField(key: keyof RegentConfig, current: number) {
    setEditField(key)
    setEditValue(String(current))
  }

  async function commitField() {
    if (!editField || !config) return
    const val = parseFloat(editValue)
    if (!isNaN(val)) await persist({ ...config, [editField]: val } as RegentConfig)
    setEditField(null)
  }

  async function commitPayment() {
    if (editPaymentIndex === null || !config) return
    const val = parseFloat(editPaymentValue)
    if (!isNaN(val)) {
      const payments = config.payments.map((p, i) => i === editPaymentIndex ? { ...p, amount: val } : p)
      await persist({ ...config, payments })
    }
    setEditPaymentIndex(null)
  }

  async function onAddEmi(data: EmiForm) {
    setEmiLoading(true)
    const ref = await addRegentEmi({ date: data.date, amount: Number(data.amount) })
    setEmis(prev => [...prev, { id: ref.id, date: data.date, amount: Number(data.amount) }].sort((a,b)=>b.date.localeCompare(a.date)))
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
    const ok = await confirm({
      title: 'Remove EMI entry',
      message: `Remove the EMI of ₹${emi?.amount.toLocaleString()} on ${emi?.date}?`,
    })
    if (!ok) return
    await deleteRegentEmi(id)
    setEmis(prev => prev.filter(e => e.id !== id))
  }

  function editable(key: keyof RegentConfig, label: string, value: number) {
    return (
      <div className="flex justify-between items-center py-2 border-b border-gray-800/50">
        <span className="text-gray-400 text-sm">{label}</span>
        {!isReadOnly && editField === key ? (
          <div className="flex gap-1">
            <input type="number" className="input w-32 text-right text-sm"
              value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitField()} autoFocus />
            <button onClick={commitField} className="btn-primary text-xs px-2">OK</button>
          </div>
        ) : isReadOnly ? (
          <span className="text-gray-200 text-sm">₹{fmtINR(value)}</span>
        ) : (
          <button className="text-gray-200 text-sm hover:text-white hover:underline"
            onClick={() => startEditField(key, value)}>
            ₹{fmtINR(value)}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-white">Regent Property</h1>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Cost breakdown */}
        <div className="card space-y-0">
          <h2 className="font-semibold text-white mb-3">Cost Breakdown</h2>
          {editable('sqft', 'Area (sqft)', config.sqft)}
          {editable('baseRate', 'Base Rate (₹/sqft)', config.baseRate)}
          <div className="flex justify-between py-2 border-b border-gray-800/50">
            <span className="text-gray-400 text-sm">Base Price</span>
            <span className="text-gray-200 text-sm">₹{fmtINR(baseTotal)}</span>
          </div>
          {editable('floorRisePremium', 'Floor Rise Premium', config.floorRisePremium)}
          {editable('premiumLocation', 'Premium Location', config.premiumLocation)}
          {editable('carParking', 'Car Parking', config.carParking)}
          {editable('infraCharges', 'Infra Charges', config.infraCharges)}
          {editable('clubHouseCharges', 'Club House Charges', config.clubHouseCharges)}

          <div className="flex justify-between py-2.5 border-t border-gray-700 mt-1">
            <span className="font-semibold text-white">Total</span>
            <span className="font-semibold text-white">₹{fmtINR(totalCost)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-gray-400">Saleable Value (+5% GST)</span>
            <span className="text-gray-200">₹{fmtINR(withGst)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm">
            <span className="text-gray-400">Refunded if cancelled (-20%)</span>
            <span className="text-gray-200">₹{fmtINR(refunded)}</span>
          </div>
          {editable('principalOutstanding', 'Principal Outstanding', config.principalOutstanding)}
          <div className="flex justify-between py-3 border-t border-gray-700 mt-1">
            <span className="font-bold text-white">I get to keep</span>
            <span className={`font-bold text-lg ${iGetToKeep >= 0 ? 'positive' : 'negative'}`}>
              ₹{fmtINR(iGetToKeep)}
            </span>
          </div>
        </div>

        {/* Right column: Payments + P&L */}
        <div className="space-y-5">
          {/* Payments */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3">Payments Made</h2>
            <div className="space-y-0">
              {config.payments.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-800/50">
                  <Tooltip content={p.label}>
                    <span className="text-gray-400 text-sm truncate max-w-[160px] block">{p.label}</span>
                  </Tooltip>
                  {!isReadOnly && editPaymentIndex === i ? (
                    <div className="flex gap-1">
                      <input type="number" className="input w-28 text-right text-sm"
                        value={editPaymentValue} onChange={e => setEditPaymentValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && commitPayment()} autoFocus />
                      <button onClick={commitPayment} className="btn-primary text-xs px-2">OK</button>
                    </div>
                  ) : isReadOnly ? (
                    <span className="text-gray-200 text-sm">₹{fmtINR(p.amount)}</span>
                  ) : (
                    <button className="text-gray-200 text-sm hover:underline"
                      onClick={() => { setEditPaymentIndex(i); setEditPaymentValue(String(p.amount)) }}>
                      ₹{fmtINR(p.amount)}
                    </button>
                  )}
                </div>
              ))}
              <div className="flex justify-between py-2 border-b border-gray-800/50">
                <span className="text-gray-400 text-sm">Home Loan EMIs (sum)</span>
                <span className="text-gray-200 text-sm">₹{fmtINR(emiSum)}</span>
              </div>
              <div className="flex justify-between pt-2.5">
                <span className="font-semibold text-white text-sm">Total From Pocket</span>
                <span className="font-semibold text-white">₹{fmtINR(totalFromPocket)}</span>
              </div>
            </div>
          </div>

          {/* P&L */}
          <div className="card">
            <h2 className="font-semibold text-white mb-3">Profit / Loss</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">I get to keep</span>
                <span className="text-gray-200">₹{fmtINR(iGetToKeep)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total From Pocket</span>
                <span className="text-gray-200">₹{fmtINR(totalFromPocket)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2">
                <span className="font-semibold text-white">P/L Amount</span>
                <span className={`font-bold text-base ${profitLoss >= 0 ? 'positive' : 'negative'}`}>
                  ₹{fmtINR(profitLoss)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-white">P/L %</span>
                <span className={`font-bold text-base ${profitLoss >= 0 ? 'positive' : 'negative'}`}>
                  {profitLossPct.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* EMI Schedule */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Home Loan EMI Schedule</h2>
          {!isReadOnly && (
            <button
              onClick={() => {
                if (!showAddEmi && emis.length > 0) resetEmi({ date: '', amount: emis[0].amount })
                setShowAddEmi(v => !v)
              }}
              className="btn-primary text-xs px-3 py-1.5"
            >
              + Add EMI
            </button>
          )}
        </div>

        {showAddEmi && (
          <form onSubmit={handleEmi(onAddEmi)} className="flex gap-2 mb-4">
            <input type="date" className="input flex-1 text-sm" {...regEmi('date', { required: true })} />
            <input type="number" step="any" className="input w-32 text-sm" placeholder="Amount"
              {...regEmi('amount', { required: true, valueAsNumber: true })} />
            <button type="submit" disabled={emiLoading} className="btn-primary text-xs px-3">
              {emiLoading ? '…' : 'Add'}
            </button>
          </form>
        )}

        <div className="max-h-64 overflow-y-auto divide-y divide-gray-800">
          {emis.map(emi => (
            <div key={emi.id} className="flex items-center justify-between py-2 group">
              <span className="text-gray-400 text-sm">{isoToDisplay(emi.date)}</span>
              <div className="flex items-center gap-3">
                {!isReadOnly && editEmiId === emi.id ? (
                  <div className="flex gap-1">
                    <input
                      type="number" className="input w-28 text-right text-sm"
                      value={editEmiValue}
                      onChange={e => setEditEmiValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEmiEdit(); if (e.key === 'Escape') setEditEmiId(null) }}
                      onBlur={commitEmiEdit}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => !isReadOnly && (setEditEmiId(emi.id), setEditEmiValue(String(emi.amount)))}
                    className={`text-gray-200 text-sm ${!isReadOnly ? 'hover:underline' : ''}`}
                  >
                    ₹{fmtINR(emi.amount)}
                  </button>
                )}
                {!isReadOnly && <button onClick={() => removeEmi(emi.id)}
                  className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                  ✕
                </button>}
              </div>
            </div>
          ))}
          {emis.length === 0 && <p className="text-gray-600 text-sm py-2">No EMI entries yet.</p>}
        </div>

        {emis.length > 0 && (
          <div className="flex justify-between pt-3 border-t border-gray-700 mt-2">
            <span className="font-semibold text-white text-sm">EMI Total</span>
            <span className="font-semibold text-white">₹{fmtINR(emiSum)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
