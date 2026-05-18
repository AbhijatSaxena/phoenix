import { useEffect, useState } from 'react'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { useSnapshotStore } from '../store/snapshotStore'
import type { Account, Category } from '../types'
import { fmtINR, fmtCurrency } from '../lib/fmt'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'
import { useForm } from 'react-hook-form'
import { useIsReadOnly } from '../store/authStore'
import Tooltip from '../components/Tooltip'

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

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'liquid',       label: 'Liquid' },
  { key: 'appreciating', label: 'Appreciating Assets' },
  { key: 'depreciating', label: 'Depreciating Assets' },
]

interface EditForm {
  usd: number
  cad: number
  inr: number
}

export default function DashboardPage() {
  const { accounts, loading, load, update } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const { saveSnapshot, load: loadSnapshots } = useSnapshotStore()

  const [editing, setEditing] = useState<Account | null>(null)
  const [snapshotNote, setSnapshotNote] = useState('')
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<Category, boolean>>({
    liquid: false, appreciating: false, depreciating: false,
  })

  const { register, handleSubmit, reset } = useForm<EditForm>()
  const isReadOnly = useIsReadOnly()

  useEffect(() => { load() }, []) // re-runs on every mount (route navigation remounts)

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const byCategory = (cat: Category) => accounts.filter(a => a.category === cat)

  const sectionTotal = (cat: Category) =>
    byCategory(cat).reduce((sum, a) => sum + computeNetInr(a, usdInr, cadInr), 0)

  const liquid       = sectionTotal('liquid')
  const appreciating = sectionTotal('appreciating')
  const depreciating = sectionTotal('depreciating')
  const netWorth     = liquid + appreciating + depreciating

  function openEdit(account: Account) {
    if (account.derived || isReadOnly) return
    setEditing(account)
    reset({ usd: account.usd, cad: account.cad, inr: account.inr })
  }

  async function onSubmitEdit(data: EditForm) {
    if (!editing) return
    await update({
      ...editing,
      usd: isNaN(Number(data.usd)) ? 0 : Number(data.usd),
      cad: isNaN(Number(data.cad)) ? 0 : Number(data.cad),
      inr: isNaN(Number(data.inr)) ? 0 : Number(data.inr),
    })
    setEditing(null)
  }

  async function handleSaveSnapshot() {
    setSavingSnapshot(true)
    await saveSnapshot(liquid, appreciating, depreciating, snapshotNote)
    await loadSnapshots()
    setSavingSnapshot(false)
    setShowSnapshotModal(false)
    setSnapshotNote('')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Net worth summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Liquid',       value: liquid,       color: 'text-sky-400' },
          { label: 'Appreciating', value: appreciating, color: 'text-emerald-400' },
          { label: 'Depreciating', value: depreciating, color: 'text-amber-400' },
          { label: 'Net Worth',    value: netWorth,     color: 'text-white text-lg font-bold' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <p className="label mb-1">{label}</p>
            <p className={`font-semibold ${color}`}>₹{fmtINR(value)}</p>
          </div>
        ))}
      </div>

      {/* Save Snapshot button */}
      {!isReadOnly && (
        <div className="flex justify-end">
          <button onClick={() => setShowSnapshotModal(true)} className="btn-primary text-sm">
            📸 Save Snapshot
          </button>
        </div>
      )}

      {/* Account sections */}
      {CATEGORIES.map(({ key, label }) => (
        <section key={key} className="card space-y-0">
          <button
            className="w-full flex items-center justify-between py-1 mb-3"
            onClick={() => setCollapsed(c => ({ ...c, [key]: !c[key] }))}
          >
            <h2 className="font-semibold text-white">{label}</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">₹{fmtINR(sectionTotal(key))}</span>
              <span className="text-gray-600 text-sm">{collapsed[key] ? '▶' : '▼'}</span>
            </div>
          </button>

          {!collapsed[key] && (
            <div className="divide-y divide-gray-800">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto] sm:grid-cols-6 text-xs text-gray-600 pb-1.5 px-1">
                <span className="sm:col-span-2">Account</span>
                <span className="hidden sm:block text-right">USD</span>
                <span className="hidden sm:block text-right">CAD</span>
                <span className="hidden sm:block text-right">INR</span>
                <span className="text-right">NET (INR)</span>
              </div>

              {byCategory(key).map(account => {
                const net = computeNetInr(account, usdInr, cadInr)
                const clickable = !account.derived && !isReadOnly
                return (
                  <div
                    key={account.id}
                    className={`grid grid-cols-[1fr_auto] sm:grid-cols-6 py-2 px-1 text-sm ${
                      clickable ? 'cursor-pointer hover:bg-gray-800 rounded' : ''
                    }`}
                    onClick={() => clickable && openEdit(account)}
                  >
                    <span className="sm:col-span-2 flex flex-col justify-center min-w-0">
                      <Tooltip content={account.name} className="flex items-center gap-1.5 min-w-0">
                        <span className="text-gray-200 truncate">{account.name}</span>
                        {account.derived && (
                          <span className="text-[10px] text-gray-600 border border-gray-700 px-1 rounded shrink-0">
                            {account.derived}
                          </span>
                        )}
                      </Tooltip>
                      {account.updatedAt && (
                        <span className="text-[10px] text-gray-600 mt-0.5">
                          {timeAgo(account.updatedAt)}
                        </span>
                      )}
                    </span>
                    <span className="hidden sm:block text-right text-gray-400">
                      {account.usd !== 0 ? fmtCurrency(account.usd, 'USD') : '—'}
                    </span>
                    <span className="hidden sm:block text-right text-gray-400">
                      {account.cad !== 0 ? fmtCurrency(account.cad, 'CAD') : '—'}
                    </span>
                    <span className="hidden sm:block text-right text-gray-400">
                      {account.inr !== 0 ? `₹${fmtINR(account.inr)}` : '—'}
                    </span>
                    <span className={`text-right font-medium ${net < 0 ? 'negative' : 'text-gray-100'}`}>
                      ₹{fmtINR(net)}
                    </span>
                  </div>
                )
              })}

              {byCategory(key).length === 0 && (
                <p className="text-sm text-gray-600 py-2 px-1">No accounts</p>
              )}
            </div>
          )}
        </section>
      ))}

      {/* Edit modal */}
      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
            {(['usd', 'cad', 'inr'] as const).map(field => (
              <div key={field}>
                <label className="label block mb-1">{field.toUpperCase()} Amount</label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  {...register(field, { valueAsNumber: true })}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn-primary flex-1">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Snapshot modal */}
      {showSnapshotModal && (
        <Modal title="Save Snapshot" onClose={() => setShowSnapshotModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: 'Liquid',       value: liquid },
                { label: 'Appreciating', value: appreciating },
                { label: 'Depreciating', value: depreciating },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                  <p className="label mb-1">{label}</p>
                  <p className="text-white font-medium text-xs">₹{fmtINR(value)}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400">
              Total: <span className="text-white font-semibold">₹{fmtINR(netWorth)}</span>
            </p>
            <div>
              <label className="label block mb-1">Note (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Salary came, crypto went up..."
                value={snapshotNote}
                onChange={e => setSnapshotNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {savingSnapshot ? <Spinner size="sm" /> : null}
                Save
              </button>
              <button onClick={() => setShowSnapshotModal(false)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
