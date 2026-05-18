import { useEffect, useState } from 'react'
import { confirm } from '../components/ConfirmDialog'
import { useSnapshotStore } from '../store/snapshotStore'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { fmtINR, fmtDiff, diffClass, isoToDisplay } from '../lib/fmt'
import { useIsReadOnly } from '../store/authStore'
import HoverTooltip from '../components/Tooltip'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'

export default function SnapshotsPage() {
  const { snapshots, loading, load, saveSnapshot, updateSnapshot, removeSnapshot } = useSnapshotStore()
  const accounts   = useDashboardStore(s => s.accounts)
  const rates      = useRatesStore(s => s.rates)
  const [showModal, setShowModal] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const isReadOnly = useIsReadOnly()

  // Inline row editing
  type EditField = 'total' | 'notes'
  const [editCell, setEditCell] = useState<{ id: string; field: EditField } | null>(null)
  const [editValue, setEditValue] = useState('')

  function startCellEdit(id: string, field: EditField, current: string) {
    setEditCell({ id, field })
    setEditValue(current)
  }

  async function commitCellEdit() {
    if (!editCell) return
    const snap = snapshots.find(s => s.id === editCell.id)
    if (!snap) { setEditCell(null); return }

    if (editCell.field === 'total') {
      const newTotal = parseFloat(editValue)
      if (!isNaN(newTotal)) {
        await updateSnapshot({ ...snap, total: newTotal })
      }
    } else {
      await updateSnapshot({ ...snap, notes: editValue })
    }
    setEditCell(null)
  }

  function handleCellKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitCellEdit()
    if (e.key === 'Escape') setEditCell(null)
  }

  useEffect(() => { load() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const liquid       = accounts.filter(a => a.category === 'liquid').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const appreciating = accounts.filter(a => a.category === 'appreciating').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)
  const depreciating = accounts.filter(a => a.category === 'depreciating').reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  async function handleSave() {
    setSaving(true)
    await saveSnapshot(liquid, appreciating, depreciating, note)
    setSaving(false)
    setShowModal(false)
    setNote('')
  }

  // Chart data — last 40 entries
  const chartData = snapshots.slice(-40).map(s => ({
    date: s.date.slice(5),  // MM-DD
    total: Math.round(s.total / 1_00_000), // in lakhs
    label: s.date,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const snap = snapshots.find(s => s.date.slice(5) === label)
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-gray-400 mb-1">{snap ? isoToDisplay(snap.date) : label}</p>
        <p className="text-white font-semibold">₹{payload[0].value}L</p>
        {snap?.notes && <p className="text-gray-500 mt-1 max-w-[180px] truncate">{snap.notes}</p>}
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Snapshots</h1>
        {!isReadOnly && (
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
            📸 Save Snapshot
          </button>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="card">
          <p className="label mb-3">Net Worth over time (₹ Lakhs)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v}L`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#60a5fa' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-800">
            <tr className="text-left">
              <th className="px-4 py-3 label">Date</th>
              <th className="px-4 py-3 label text-right hidden sm:table-cell">Liquid</th>
              <th className="px-4 py-3 label text-right hidden sm:table-cell">Appreciating</th>
              <th className="px-4 py-3 label text-right hidden sm:table-cell">Depreciating</th>
              <th className="px-4 py-3 label text-right">Total</th>
              <th className="px-4 py-3 label text-right">Diff</th>
              <th className="px-4 py-3 label hidden sm:table-cell">Notes</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[...snapshots].reverse().map(s => (
              <tr key={s.id} className="hover:bg-gray-900/50 transition-colors group">
                <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{isoToDisplay(s.date)}</td>
                <td className="px-4 py-2.5 text-right text-gray-400 hidden sm:table-cell">₹{fmtINR(s.liquid)}</td>
                <td className="px-4 py-2.5 text-right text-gray-400 hidden sm:table-cell">₹{fmtINR(s.appreciating)}</td>
                <td className="px-4 py-2.5 text-right text-gray-400 hidden sm:table-cell">₹{fmtINR(s.depreciating)}</td>

                {/* Total — editable */}
                <td className="px-2 py-1.5 text-right">
                  {!isReadOnly && editCell?.id === s.id && editCell.field === 'total' ? (
                    <input
                      type="text" inputMode="decimal" autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitCellEdit}
                      onKeyDown={handleCellKey}
                      className="w-28 bg-blue-900/60 border border-blue-500 rounded px-1.5 py-0.5 text-right text-xs text-white focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => !isReadOnly && startCellEdit(s.id, 'total', String(s.total))}
                      className={`text-white font-medium ${!isReadOnly ? 'hover:underline cursor-pointer' : ''}`}
                    >
                      ₹{fmtINR(s.total)}
                    </button>
                  )}
                </td>

                <td className={`px-4 py-2.5 text-right font-medium ${diffClass(s.difference)}`}>
                  {fmtDiff(s.difference)}
                </td>

                {/* Notes — editable */}
                <td className="px-2 py-1.5 max-w-xs hidden sm:table-cell">
                  {!isReadOnly && editCell?.id === s.id && editCell.field === 'notes' ? (
                    <input
                      type="text" autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={commitCellEdit}
                      onKeyDown={handleCellKey}
                      className="w-full bg-blue-900/60 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                    />
                  ) : (
                    <HoverTooltip content={s.notes}>
                      <span
                        onClick={() => !isReadOnly && startCellEdit(s.id, 'notes', s.notes)}
                        className={`block truncate text-gray-500 ${!isReadOnly ? 'cursor-text hover:text-gray-300' : ''}`}
                      >
                        {s.notes || <span className="text-gray-700">—</span>}
                      </span>
                    </HoverTooltip>
                  )}
                </td>

                {/* Delete */}
                <td className="px-2 py-1.5">
                  {!isReadOnly && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete snapshot', message: `Delete snapshot for ${isoToDisplay(s.date)}?` })
                        if (ok) removeSnapshot(s.id)
                      }}
                      className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {snapshots.length === 0 && (
          <p className="text-center text-gray-600 py-8">No snapshots yet.</p>
        )}
      </div>

      {showModal && (
        <Modal title="Save Snapshot" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-sm">
              {[['Liquid', liquid], ['Appreciating', appreciating], ['Depreciating', depreciating]].map(([l, v]) => (
                <div key={String(l)} className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="label text-[10px] mb-0.5">{l}</p>
                  <p className="text-white font-medium text-xs">₹{fmtINR(Number(v))}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400">Total: <span className="text-white font-semibold">₹{fmtINR(liquid + appreciating + depreciating)}</span></p>
            <div>
              <label className="label block mb-1">Note (optional)</label>
              <input type="text" className="input" placeholder="What happened this period?"
                value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving && <Spinner size="sm" />} Save
              </button>
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
