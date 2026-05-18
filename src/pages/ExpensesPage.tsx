import { useEffect, useState, useMemo, useRef, RefObject } from 'react'
import {
  fetchAllExpenses, saveMonthExpenses, deleteMonthExpenses,
  fetchExpenseRowOrder, saveExpenseRowOrder,
} from '../services/firebase'
import type { Currency, MonthExpenses } from '../types'
import Spinner from '../components/Spinner'
import { confirm } from '../components/ConfirmDialog'
import { useIsReadOnly } from '../store/authStore'
import Tooltip from '../components/Tooltip'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Module-level components (stable types across renders) ─────────────────────

function CellInput({ inputRef, value, onChange, onBlur, onKeyDown }: {
  inputRef: RefObject<HTMLInputElement>
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="w-full bg-blue-900/60 border border-blue-500 rounded px-1.5 py-0.5 text-right text-xs text-white focus:outline-none"
    />
  )
}

interface RowProps {
  name: string
  months: string[]
  isReadOnly: boolean
  editingItemName: string | null
  editingItemValue: string
  editCell: { row: string; col: string } | null
  editValue: string
  inputRef: RefObject<HTMLInputElement>
  getAmount: (ym: string, name: string) => number
  fmt: (n: number) => React.ReactNode
  onStartEditName: (name: string) => void
  onEditingItemValueChange: (v: string) => void
  onRenameItem: (oldName: string, newName: string) => void
  onCancelRename: () => void
  onStartCellEdit: (row: string, col: string, val: string) => void
  onCommitEdit: () => void
  onEditValueChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onRemoveRow: (name: string) => void
}

function SortableExpenseRow({
  name, months, isReadOnly,
  editingItemName, editingItemValue,
  editCell, editValue, inputRef,
  getAmount, fmt,
  onStartEditName, onEditingItemValueChange, onRenameItem, onCancelRename,
  onStartCellEdit, onCommitEdit, onEditValueChange, onKeyDown, onRemoveRow,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: name })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? ('relative' as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-900/40 group">
      <td className="sticky left-0 z-10 bg-gray-950 group-hover:bg-gray-900/80 px-2 py-2 text-gray-300 border-r border-gray-800">
        <div className="flex items-center gap-1.5">
          {/* Drag handle */}
          {!isReadOnly && (
            <button
              {...attributes}
              {...listeners}
              className="text-gray-700 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0 text-base leading-none"
              tabIndex={-1}
            >⠿</button>
          )}

          {!isReadOnly && editingItemName === name ? (
            <input
              type="text"
              autoFocus
              value={editingItemValue}
              onChange={e => onEditingItemValueChange(e.target.value)}
              onBlur={() => onRenameItem(name, editingItemValue)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRenameItem(name, editingItemValue)
                if (e.key === 'Escape') onCancelRename()
              }}
              className="flex-1 min-w-0 bg-blue-900/60 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
            />
          ) : (
            <Tooltip content={name} className="flex-1 min-w-0">
              <span
                className={`block truncate max-w-32 ${!isReadOnly ? 'cursor-text hover:text-white' : ''}`}
                onClick={() => { if (!isReadOnly) onStartEditName(name) }}
              >{name}</span>
            </Tooltip>
          )}

          {!isReadOnly && editingItemName !== name && (
            <button
              onClick={() => onRemoveRow(name)}
              className="text-gray-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-xs"
            >✕</button>
          )}
        </div>
      </td>
      {months.map(ym => {
        const isEditing = editCell?.row === name && editCell.col === ym
        const val = getAmount(ym, name)
        return (
          <td key={ym} className="px-2 py-1.5 text-right">
            {isEditing ? (
              <CellInput inputRef={inputRef} value={editValue} onChange={onEditValueChange}
                onBlur={onCommitEdit} onKeyDown={onKeyDown} />
            ) : isReadOnly ? (
              <span className="text-gray-400">{fmt(val)}</span>
            ) : (
              <button
                onClick={() => onStartCellEdit(name, ym, String(val))}
                className="w-full text-right text-gray-400 hover:text-gray-100 hover:underline"
              >{fmt(val)}</button>
            )}
          </td>
        )
      })}
      <td />
    </tr>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const CURRENCIES: Currency[] = ['INR', 'USD', 'CAD']
const SYMBOL: Record<Currency, string> = { INR: '₹', USD: '$', CAD: 'C$' }

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`
}

function currentYearMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

export default function ExpensesPage() {
  const [activeCurrency, setActiveCurrency] = useState<Currency>('USD')
  const [expenses, setExpenses] = useState<MonthExpenses[]>([])
  const [rowOrder, setRowOrder] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [editCell, setEditCell] = useState<{ row: string; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingItemName, setEditingItemName] = useState<string | null>(null)
  const [editingItemValue, setEditingItemValue] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [extraMonths, setExtraMonths] = useState<string[]>([])
  const [showAddMonth, setShowAddMonth] = useState(false)
  const [addMonthValue, setAddMonthValue] = useState('')
  const [fromMonth, setFromMonth] = useState('')
  const [toMonth, setToMonth] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isReadOnly = useIsReadOnly()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  useEffect(() => { loadExpenses(); setExtraMonths([]); setFromMonth(''); setToMonth('') }, [activeCurrency])
  useEffect(() => { if (editCell) inputRef.current?.focus() }, [editCell])

  async function loadExpenses() {
    setLoading(true)
    const [data, order] = await Promise.all([
      fetchAllExpenses(activeCurrency) as Promise<MonthExpenses[]>,
      fetchExpenseRowOrder(activeCurrency),
    ])
    setExpenses(data)
    setRowOrder(order)
    setLoading(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const allMonths = useMemo(() => {
    const set = new Set(expenses.map(e => e.yearMonth))
    set.add(currentYearMonth())
    extraMonths.forEach(m => set.add(m))
    return Array.from(set).sort()
  }, [expenses, extraMonths])

  const months = useMemo(() => {
    return allMonths.filter(ym =>
      (!fromMonth || ym >= fromMonth) &&
      (!toMonth   || ym <= toMonth)
    )
  }, [allMonths, fromMonth, toMonth])

  const itemNames = useMemo(() => {
    const allNames = new Set<string>()
    expenses.forEach(e => e.items.forEach(item => allNames.add(item.name)))
    // Start with stored order (filtered to names that still exist)
    const ordered = rowOrder.filter(n => allNames.has(n))
    // Append any new items not yet in rowOrder
    const orderedSet = new Set(ordered)
    allNames.forEach(n => { if (!orderedSet.has(n)) ordered.push(n) })
    return ordered
  }, [expenses, rowOrder])

  function getMonth(ym: string): MonthExpenses {
    return expenses.find(e => e.yearMonth === ym) ?? {
      id: `${activeCurrency}-${ym}`,
      currency: activeCurrency,
      yearMonth: ym,
      salary: 0,
      items: [],
    }
  }

  function getAmount(ym: string, itemName: string): number {
    return getMonth(ym).items.find(i => i.name === itemName)?.amount ?? 0
  }

  function getSaving(ym: string): number {
    const m = getMonth(ym)
    return m.salary - m.items.reduce((s, i) => s + i.amount, 0)
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  async function persistMonth(m: MonthExpenses) {
    await saveMonthExpenses(m as unknown as Record<string, unknown>)
    setExpenses(prev => {
      const without = prev.filter(e => e.id !== m.id)
      return [...without, m].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    })
  }

  async function persistRowOrder(order: string[]) {
    setRowOrder(order)
    await saveExpenseRowOrder(activeCurrency, order)
  }

  // ── Cell editing ──────────────────────────────────────────────────────────

  function startEdit(row: string, col: string, currentVal: string) {
    setEditCell({ row, col })
    setEditValue(currentVal === '0' ? '' : currentVal)
  }

  async function commitEdit() {
    if (!editCell) return
    const val = parseFloat(editValue)
    const amount = isNaN(val) ? 0 : val
    const { row, col } = editCell

    if (row === '__salary__') {
      const m = getMonth(col)
      await persistMonth({ ...m, salary: amount })
    } else {
      const m = getMonth(col)
      const itemExists = m.items.some(i => i.name === row)
      const items = itemExists
        ? m.items.map(i => i.name === row ? { ...i, amount } : i)
        : [...m.items, { name: row, amount }]
      await persistMonth({ ...m, items })
    }
    setEditCell(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditCell(null)
  }

  // ── Row management ────────────────────────────────────────────────────────

  async function addItem() {
    const name = newItemName.trim()
    if (!name || itemNames.includes(name)) return
    const cur = currentYearMonth()
    const m = getMonth(cur)
    await persistMonth({ ...m, items: [...m.items, { name, amount: 0 }] })
    await persistRowOrder([...itemNames, name])
    setNewItemName('')
  }

  async function addMonth() {
    if (!addMonthValue) return
    setShowAddMonth(false)
    setAddMonthValue('')
    if (months.includes(addMonthValue)) return
    const prev = expenses
      .filter(e => e.yearMonth < addMonthValue)
      .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]
    if (prev) {
      await persistMonth({
        id: `${activeCurrency}-${addMonthValue}`,
        currency: activeCurrency,
        yearMonth: addMonthValue,
        salary: prev.salary,
        items: prev.items,
      })
    } else {
      setExtraMonths(p => [...p, addMonthValue])
    }
  }

  async function deleteMonth(ym: string) {
    const ok = await confirm({
      title: 'Delete month',
      message: `Delete all data for ${monthLabel(ym)}? This cannot be undone.`,
    })
    if (!ok) return
    const id = `${activeCurrency}-${ym}`
    await deleteMonthExpenses(id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setExtraMonths(prev => prev.filter(m => m !== ym))
  }

  async function renameItem(oldName: string, newName: string) {
    const trimmed = newName.trim()
    setEditingItemName(null)
    if (!trimmed || trimmed === oldName || itemNames.includes(trimmed)) return
    for (const m of expenses) {
      if (m.items.some(i => i.name === oldName)) {
        await persistMonth({ ...m, items: m.items.map(i => i.name === oldName ? { ...i, name: trimmed } : i) })
      }
    }
    await persistRowOrder(itemNames.map(n => n === oldName ? trimmed : n))
  }

  async function removeRow(itemName: string) {
    const ok = await confirm({
      title: 'Remove expense row',
      message: `Remove "${itemName}" from all months? This cannot be undone.`,
    })
    if (!ok) return
    for (const m of expenses) {
      if (m.items.some(i => i.name === itemName)) {
        await persistMonth({ ...m, items: m.items.filter(i => i.name !== itemName) })
      }
    }
    await persistRowOrder(itemNames.filter(n => n !== itemName))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = itemNames.indexOf(active.id as string)
    const newIndex = itemNames.indexOf(over.id as string)
    const reordered = arrayMove(itemNames, oldIndex, newIndex)
    persistRowOrder(reordered)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const sym = SYMBOL[activeCurrency]

  function fmt(n: number): React.ReactNode {
    if (n === 0) return <span className="text-gray-700">—</span>
    return <>{sym}{Math.abs(n).toLocaleString()}</>
  }

  return (
    <div className="space-y-4 max-w-full">
      <h1 className="text-xl font-bold text-white">Expenses</h1>

      {/* Currency tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {CURRENCIES.map(c => (
          <button key={c} onClick={() => setActiveCurrency(c)}
            className={`px-5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeCurrency === c ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}>{c}</button>
        ))}
      </div>

      {/* Month range filter */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-400">Show:</span>
        <div className="flex items-center gap-1.5">
          <input type="month" className="input text-xs py-1 px-2 w-32" value={fromMonth}
            onChange={e => setFromMonth(e.target.value)} />
          <span className="text-gray-600">to</span>
          <input type="month" className="input text-xs py-1 px-2 w-32" value={toMonth}
            onChange={e => setToMonth(e.target.value)} />
        </div>
        {(fromMonth || toMonth) && (
          <button onClick={() => { setFromMonth(''); setToMonth('') }}
            className="text-gray-600 hover:text-gray-300 text-xs">Clear</button>
        )}
        <span className="text-gray-700 text-xs">{months.length} month{months.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Spinner /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse min-w-max w-full">
              <thead>
                <tr className="bg-gray-800">
                  <th className="sticky left-0 z-10 bg-gray-800 text-left px-4 py-2.5 label border-r border-gray-700 w-44 min-w-44">
                    Item
                  </th>
                  {months.map(ym => (
                    <th key={ym} className="px-3 py-2.5 label text-right whitespace-nowrap min-w-28 group/month">
                      <span className="flex items-center justify-end gap-1">
                        {monthLabel(ym)}
                        {!isReadOnly && (
                          <button onClick={() => deleteMonth(ym)}
                            className="opacity-0 group-hover/month:opacity-100 text-gray-600 hover:text-red-500 transition-opacity text-[10px] leading-none"
                            title={`Delete ${monthLabel(ym)}`}>✕</button>
                        )}
                      </span>
                    </th>
                  ))}
                  {!isReadOnly && <th className="px-3 py-2.5 whitespace-nowrap">
                    {showAddMonth ? (
                      <div className="flex items-center gap-1">
                        <input type="month" className="input text-xs py-0.5 px-1.5 w-32" value={addMonthValue}
                          onChange={e => setAddMonthValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addMonth(); if (e.key === 'Escape') setShowAddMonth(false) }}
                          autoFocus />
                        <button onClick={addMonth} className="btn-primary text-xs px-2 py-0.5">OK</button>
                        <button onClick={() => setShowAddMonth(false)} className="text-gray-600 hover:text-gray-300 text-xs px-1">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddMonth(true)}
                        className="text-gray-600 hover:text-blue-400 text-xs font-medium border border-gray-700 hover:border-blue-500 rounded px-2 py-0.5 transition-colors">
                        + Month
                      </button>
                    )}
                  </th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-800/60">
                {/* SALARY */}
                <tr className="bg-gray-900/80 font-semibold">
                  <td className="sticky left-0 z-10 bg-gray-900 px-4 py-2 text-emerald-400 border-r border-gray-700">
                    SALARY
                  </td>
                  {months.map(ym => {
                    const isEditing = editCell?.row === '__salary__' && editCell.col === ym
                    const val = getMonth(ym).salary
                    return (
                      <td key={ym} className="px-2 py-1.5 text-right">
                        {isEditing ? (
                          <CellInput inputRef={inputRef} value={editValue} onChange={setEditValue}
                            onBlur={commitEdit} onKeyDown={handleKeyDown} />
                        ) : isReadOnly ? (
                          <span className="text-emerald-400">
                            {val ? `${sym}${val.toLocaleString()}` : <span className="text-gray-700">—</span>}
                          </span>
                        ) : (
                          <button onClick={() => startEdit('__salary__', ym, String(val))}
                            className="w-full text-right text-emerald-400 hover:text-emerald-300 hover:underline">
                            {val ? `${sym}${val.toLocaleString()}` : <span className="text-gray-700">—</span>}
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td />
                </tr>

                {/* Expense item rows — sortable */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={itemNames} strategy={verticalListSortingStrategy}>
                    {itemNames.map(name => (
                      <SortableExpenseRow
                        key={name}
                        name={name}
                        months={months}
                        isReadOnly={isReadOnly}
                        editingItemName={editingItemName}
                        editingItemValue={editingItemValue}
                        editCell={editCell}
                        editValue={editValue}
                        inputRef={inputRef}
                        getAmount={getAmount}
                        fmt={fmt}
                        onStartEditName={n => { setEditingItemName(n); setEditingItemValue(n) }}
                        onEditingItemValueChange={setEditingItemValue}
                        onRenameItem={renameItem}
                        onCancelRename={() => setEditingItemName(null)}
                        onStartCellEdit={startEdit}
                        onCommitEdit={commitEdit}
                        onEditValueChange={setEditValue}
                        onKeyDown={handleKeyDown}
                        onRemoveRow={removeRow}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add new item */}
                {!isReadOnly && (
                  <tr className="bg-gray-900/30">
                    <td className="sticky left-0 z-10 bg-gray-900/30 px-3 py-2 border-r border-gray-800">
                      <div className="flex gap-1.5">
                        <input type="text" className="input text-xs py-1 px-2 flex-1"
                          placeholder="+ Add expense item"
                          value={newItemName}
                          onChange={e => setNewItemName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addItem()} />
                        <button onClick={addItem} className="btn-primary text-xs px-2 py-1">Add</button>
                      </div>
                    </td>
                    {months.map(ym => <td key={ym} />)}
                    <td />
                  </tr>
                )}

                {/* SAVING / REMAINING */}
                <tr className="bg-gray-800/60 font-semibold border-t border-gray-700">
                  <td className="sticky left-0 z-10 bg-gray-800 px-4 py-2.5 text-gray-300 border-r border-gray-700">
                    {activeCurrency === 'CAD' ? 'Remaining' : 'Saving'}
                  </td>
                  {months.map(ym => {
                    const s = getSaving(ym)
                    return (
                      <td key={ym} className={`px-3 py-2.5 text-right font-semibold ${
                        s > 0 ? 'text-emerald-400' : s < 0 ? 'text-red-400' : 'text-gray-600'
                      }`}>
                        {getMonth(ym).salary === 0 && s === 0
                          ? <span className="text-gray-700">—</span>
                          : <>{s >= 0 ? '' : '-'}{sym}{Math.abs(s).toLocaleString()}</>
                        }
                      </td>
                    )
                  })}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
