import { useEffect, useState } from 'react'
import {
  fetchZerodhaConfig, saveZerodhaConfig,
  fetchZerodhaEntries, upsertZerodhaEntry, deleteZerodhaEntry,
} from '../services/firebase'
import type { ZerodhaConfig, ZerodhaEntry } from '../types'
import { confirm } from '../components/ConfirmDialog'
import { fmtINR, isoToDisplay } from '../lib/fmt'
import Spinner from '../components/Spinner'
import { useForm } from 'react-hook-form'
import { useIsReadOnly } from '../store/authStore'

type EntryForm = Omit<ZerodhaEntry, 'id'>

function netTotal(e: ZerodhaEntry) {
  return e.equityRealized + e.equityUnrealized
    + e.fnoRealized + e.fnoUnrealized
    + e.commoditiesRealized + e.commoditiesUnrealized
    + e.mfRealized + e.mfUnrealized
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

  if (loading || !config) return <div className="flex items-center justify-center h-64"><Spinner /></div>

  const latest = entries.length > 0 ? entries[entries.length - 1] : null
  const latestNet = latest ? netTotal(latest) : null
  const plPct = latestNet !== null && config.capital > 0
    ? (latestNet / config.capital) * 100 : null

  async function commitCapital() {
    const val = parseFloat(capitalInput)
    if (!isNaN(val)) {
      const updated = { capital: val }
      setConfig(updated)
      await saveZerodhaConfig(updated)
    }
    setEditCapital(false)
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
    const updated = await fetchZerodhaEntries() as ZerodhaEntry[]
    setEntries(updated)
    reset()
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
    const ok = await confirm({
      title: 'Remove portfolio entry',
      message: `Remove the entry dated ${entry?.date}?`,
    })
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

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-white">Zerodha Portfolio</h1>

      {/* Capital + summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="label mb-1">Capital Invested</p>
          {!isReadOnly && editCapital ? (
            <div className="flex gap-2 mt-1">
              <input type="number" className="input text-sm" value={capitalInput}
                onChange={e => setCapitalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitCapital()} autoFocus />
              <button onClick={commitCapital} className="btn-primary text-xs px-2">OK</button>
            </div>
          ) : isReadOnly ? (
            <p className="text-white font-semibold text-lg mt-1">₹{fmtINR(config.capital)}</p>
          ) : (
            <button className="text-white font-semibold text-lg hover:underline mt-1 block"
              onClick={() => { setEditCapital(true); setCapitalInput(String(config.capital)) }}>
              ₹{fmtINR(config.capital)}
            </button>
          )}
        </div>

        <div className="card">
          <p className="label mb-1">Latest Net P&L</p>
          <p className={`font-semibold text-lg mt-1 ${latestNet !== null && latestNet >= 0 ? 'positive' : 'negative'}`}>
            {latestNet !== null ? `₹${fmtINR(latestNet)}` : '—'}
          </p>
        </div>

        <div className="card">
          <p className="label mb-1">P/L %</p>
          <p className={`font-semibold text-lg mt-1 ${plPct !== null && plPct >= 0 ? 'positive' : 'negative'}`}>
            {plPct !== null ? `${plPct.toFixed(2)}%` : '—'}
          </p>
        </div>
      </div>

      {/* Add/Edit form */}
      {!isReadOnly && (
        <div className="flex justify-end">
          <button onClick={() => { setShowForm(v => !v); setEditingId(null); reset() }}
            className="btn-primary text-sm">
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </div>
      )}

      {showForm && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">{editingId ? 'Edit Entry' : 'New Entry'}</h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map(({ key, label }) => (
                <div key={key}>
                  <label className="label block mb-1">{label}</label>
                  <input
                    type={key === 'date' ? 'date' : 'number'}
                    step="any"
                    className="input text-sm"
                    {...register(key, { required: true })}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); reset() }}
                className="btn-ghost flex-1">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* History table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-800">
            <tr className="text-left">
              <th className="px-4 py-3 label">Date</th>
              <th className="px-4 py-3 label text-right hidden md:table-cell">Equity R</th>
              <th className="px-4 py-3 label text-right hidden md:table-cell">Equity U</th>
              <th className="px-4 py-3 label text-right hidden md:table-cell">F&O R</th>
              <th className="px-4 py-3 label text-right hidden md:table-cell">Commod R</th>
              <th className="px-4 py-3 label text-right hidden md:table-cell">MF R</th>
              <th className="px-4 py-3 label text-right">Net Total</th>
              <th className="px-4 py-3 label text-right">P/L%</th>
              <th className="px-4 py-3 label"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[...entries].reverse().map(e => {
              const net = netTotal(e)
              const pct = config.capital > 0 ? (net / config.capital) * 100 : 0
              return (
                <tr key={e.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{isoToDisplay(e.date)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">₹{fmtINR(e.equityRealized)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">₹{fmtINR(e.equityUnrealized)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">₹{fmtINR(e.fnoRealized)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">₹{fmtINR(e.commoditiesRealized)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400 hidden md:table-cell">₹{fmtINR(e.mfRealized)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${net >= 0 ? 'positive' : 'negative'}`}>
                    ₹{fmtINR(net)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${pct >= 0 ? 'positive' : 'negative'}`}>
                    {pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2.5">
                    {!isReadOnly && (
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="text-gray-600 hover:text-blue-400 text-xs">Edit</button>
                        <button onClick={() => removeEntry(e.id)} className="text-gray-600 hover:text-red-500 text-xs">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        {entries.length === 0 && <p className="text-center text-gray-600 py-8">No entries yet.</p>}
      </div>
    </div>
  )
}
