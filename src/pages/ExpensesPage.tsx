import { useEffect, useState, useMemo, useRef, RefObject } from 'react'
import {
  Box, Typography, Paper, Button, TextField, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import {
  fetchAllExpenses, saveMonthExpenses, deleteMonthExpenses,
  fetchExpenseRowOrder, saveExpenseRowOrder,
} from '../services/firebase'
import type { Currency, MonthExpenses } from '../types'
import { confirm } from '../components/ConfirmDialog'
import { useIsReadOnly } from '../store/authStore'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
      style={{
        width: '100%',
        background: 'rgba(37,99,235,0.15)',
        border: '1px solid #2563eb',
        borderRadius: 4,
        padding: '2px 6px',
        textAlign: 'right',
        fontSize: 12,
        color: 'white',
        outline: 'none',
      }}
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
  }

  return (
    <TableRow ref={setNodeRef} style={style} hover sx={{ '& .MuiTableCell-root': { py: 1 }, '&:hover .delete-row': { opacity: 1 } }}>
      <TableCell sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: '#030712', borderRight: '1px solid #1f2937', minWidth: 160, maxWidth: 160 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!isReadOnly && (
            <Box component="span" {...attributes} {...listeners} sx={{ color: 'text.disabled', cursor: 'grab', lineHeight: 0, '&:active': { cursor: 'grabbing' }, touchAction: 'none' }}>
              <DragIndicatorIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
          {!isReadOnly && editingItemName === name ? (
            <input
              autoFocus
              value={editingItemValue}
              onChange={e => onEditingItemValueChange(e.target.value)}
              onBlur={() => onRenameItem(name, editingItemValue)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRenameItem(name, editingItemValue)
                if (e.key === 'Escape') onCancelRename()
              }}
              style={{ flex: 1, minWidth: 0, background: 'rgba(37,99,235,0.15)', border: '1px solid #2563eb', borderRadius: 4, padding: '2px 6px', fontSize: 12, color: 'white', outline: 'none' }}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: isReadOnly ? 'default' : 'text', maxWidth: 120, '&:hover': isReadOnly ? {} : { color: 'text.primary' } }}
              onClick={() => !isReadOnly && onStartEditName(name)}
            >
              {name}
            </Typography>
          )}
          {!isReadOnly && editingItemName !== name && (
            <IconButton
              className="delete-row"
              size="small"
              onClick={() => onRemoveRow(name)}
              sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'error.main', p: 0.25 }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      </TableCell>
      {months.map(ym => {
        const isEditing = editCell?.row === name && editCell.col === ym
        const val = getAmount(ym, name)
        return (
          <TableCell key={ym} align="right" sx={{ minWidth: 100, color: 'text.secondary' }}>
            {isEditing ? (
              <CellInput inputRef={inputRef} value={editValue} onChange={onEditValueChange} onBlur={onCommitEdit} onKeyDown={onKeyDown} />
            ) : isReadOnly ? (
              fmt(val)
            ) : (
              <Box
                component="button"
                onClick={() => onStartCellEdit(name, ym, String(val))}
                sx={{ background: 'none', border: 'none', cursor: 'pointer', color: 'text.secondary', fontSize: 13, textAlign: 'right', width: '100%', '&:hover': { color: 'text.primary', textDecoration: 'underline' } }}
              >
                {fmt(val)}
              </Box>
            )}
          </TableCell>
        )
      })}
      <TableCell sx={{ minWidth: 20 }} />
    </TableRow>
  )
}

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

  const allMonths = useMemo(() => {
    const set = new Set(expenses.map(e => e.yearMonth))
    set.add(currentYearMonth())
    extraMonths.forEach(m => set.add(m))
    return Array.from(set).sort()
  }, [expenses, extraMonths])

  const months = useMemo(() => {
    return allMonths.filter(ym => (!fromMonth || ym >= fromMonth) && (!toMonth || ym <= toMonth))
  }, [allMonths, fromMonth, toMonth])

  const itemNames = useMemo(() => {
    const allNames = new Set<string>()
    expenses.forEach(e => e.items.forEach(item => allNames.add(item.name)))
    const ordered = rowOrder.filter(n => allNames.has(n))
    const orderedSet = new Set(ordered)
    allNames.forEach(n => { if (!orderedSet.has(n)) ordered.push(n) })
    return ordered
  }, [expenses, rowOrder])

  function getMonth(ym: string): MonthExpenses {
    return expenses.find(e => e.yearMonth === ym) ?? { id: `${activeCurrency}-${ym}`, currency: activeCurrency, yearMonth: ym, salary: 0, items: [] }
  }

  function getAmount(ym: string, itemName: string): number {
    return getMonth(ym).items.find(i => i.name === itemName)?.amount ?? 0
  }

  function getSaving(ym: string): number {
    const m = getMonth(ym)
    return m.salary - m.items.reduce((s, i) => s + i.amount, 0)
  }

  async function persistMonth(m: MonthExpenses) {
    await saveMonthExpenses(m as unknown as Record<string, unknown>)
    setExpenses(prev => [...prev.filter(e => e.id !== m.id), m].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)))
  }

  async function persistRowOrder(order: string[]) {
    setRowOrder(order)
    await saveExpenseRowOrder(activeCurrency, order)
  }

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
      await persistMonth({ ...getMonth(col), salary: amount })
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
    const prev = expenses.filter(e => e.yearMonth < addMonthValue).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0]
    if (prev) {
      await persistMonth({ id: `${activeCurrency}-${addMonthValue}`, currency: activeCurrency, yearMonth: addMonthValue, salary: prev.salary, items: prev.items })
    } else {
      setExtraMonths(p => [...p, addMonthValue])
    }
  }

  async function deleteMonth(ym: string) {
    const ok = await confirm({ title: 'Delete month', message: `Delete all data for ${monthLabel(ym)}? This cannot be undone.` })
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
    const ok = await confirm({ title: 'Remove expense row', message: `Remove "${itemName}" from all months? This cannot be undone.` })
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
    persistRowOrder(arrayMove(itemNames, oldIndex, newIndex))
  }

  const sym = SYMBOL[activeCurrency]

  function fmt(n: number): React.ReactNode {
    if (n === 0) return <span style={{ color: '#374151' }}>—</span>
    return <>{sym}{Math.abs(n).toLocaleString()}</>
  }

  return (
    <Box sx={{ maxWidth: '100%' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Expenses</Typography>

      {/* Currency tabs */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, bgcolor: '#111827', p: 0.5, borderRadius: 2, width: 'fit-content', border: '1px solid #1f2937' }}>
        {CURRENCIES.map(c => (
          <Button
            key={c}
            onClick={() => setActiveCurrency(c)}
            variant={activeCurrency === c ? 'contained' : 'text'}
            size="small"
            sx={{ minWidth: 52, fontSize: 13, color: activeCurrency === c ? 'white' : 'text.secondary' }}
          >
            {c}
          </Button>
        ))}
      </Box>

      {/* Month range filter */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">Show:</Typography>
        <TextField size="small" type="month" value={fromMonth} onChange={e => setFromMonth(e.target.value)} slotProps={{ htmlInput: { style: { fontSize: 12, padding: '4px 8px' } } }} sx={{ width: 148 }} />
        <Typography variant="body2" color="text.disabled">to</Typography>
        <TextField size="small" type="month" value={toMonth} onChange={e => setToMonth(e.target.value)} slotProps={{ htmlInput: { style: { fontSize: 12, padding: '4px 8px' } } }} sx={{ width: 148 }} />
        {(fromMonth || toMonth) && (
          <Button size="small" color="inherit" onClick={() => { setFromMonth(''); setToMonth('') }} sx={{ fontSize: 12, color: 'text.disabled' }}>Clear</Button>
        )}
        <Typography variant="caption" color="text.disabled">{months.length} month{months.length !== 1 ? 's' : ''}</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', height: 128, alignItems: 'center' }}><CircularProgress size={28} /></Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #1f2937', overflow: 'auto' }}>
          <Table size="small" sx={{ minWidth: 'max-content' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#0f172a' }}>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: '#0f172a', borderRight: '1px solid #1f2937', minWidth: 160 }}>
                  Item
                </TableCell>
                {months.map(ym => (
                  <TableCell key={ym} align="right" sx={{ minWidth: 100, whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, '&:hover .delete-month': { opacity: 1 } }}>
                      {monthLabel(ym)}
                      {!isReadOnly && (
                        <IconButton
                          className="delete-month"
                          size="small"
                          onClick={() => deleteMonth(ym)}
                          title={`Delete ${monthLabel(ym)}`}
                          sx={{ opacity: 0, transition: 'opacity 0.15s', color: 'text.disabled', '&:hover': { color: 'error.main' }, p: 0.25 }}
                        >
                          <DeleteIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                ))}
                {!isReadOnly && (
                  <TableCell align="center" sx={{ minWidth: 100 }}>
                    {showAddMonth ? (
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <TextField
                          size="small"
                          type="month"
                          value={addMonthValue}
                          onChange={e => setAddMonthValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addMonth(); if (e.key === 'Escape') setShowAddMonth(false) }}
                          autoFocus
                          slotProps={{ htmlInput: { style: { fontSize: 11, padding: '2px 6px', width: 112 } } }}
                        />
                        <Button size="small" variant="contained" onClick={addMonth} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11 }}>OK</Button>
                        <IconButton size="small" onClick={() => setShowAddMonth(false)} sx={{ p: 0.25, color: 'text.disabled' }}><DeleteIcon sx={{ fontSize: 12 }} /></IconButton>
                      </Box>
                    ) : (
                      <Button size="small" startIcon={<AddIcon sx={{ fontSize: 12 }} />} variant="outlined"
                        onClick={() => setShowAddMonth(true)}
                        sx={{ fontSize: 11, py: 0.25, px: 1, color: 'text.secondary' }}>
                        Month
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {/* Salary */}
              <TableRow sx={{ bgcolor: '#0f172a', '& .MuiTableCell-root': { py: 1 } }}>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: '#0a0f1a', borderRight: '1px solid #1f2937', fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                  SALARY
                </TableCell>
                {months.map(ym => {
                  const isEditing = editCell?.row === '__salary__' && editCell.col === ym
                  const val = getMonth(ym).salary
                  return (
                    <TableCell key={ym} align="right" sx={{ color: '#34d399' }}>
                      {isEditing ? (
                        <CellInput inputRef={inputRef} value={editValue} onChange={setEditValue} onBlur={commitEdit} onKeyDown={handleKeyDown} />
                      ) : isReadOnly ? (
                        val ? `${sym}${val.toLocaleString()}` : <span style={{ color: '#374151' }}>—</span>
                      ) : (
                        <Box component="button" onClick={() => startEdit('__salary__', ym, String(val))}
                          sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#34d399', fontSize: 13, textAlign: 'right', width: '100%', '&:hover': { textDecoration: 'underline' } }}>
                          {val ? `${sym}${val.toLocaleString()}` : <span style={{ color: '#374151' }}>—</span>}
                        </Box>
                      )}
                    </TableCell>
                  )
                })}
                {!isReadOnly && <TableCell />}
              </TableRow>

              {/* Expense rows */}
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

              {/* Add item row */}
              {!isReadOnly && (
                <TableRow sx={{ bgcolor: '#0a0f1a' }}>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: '#0a0f1a', borderRight: '1px solid #1f2937' }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <input
                        type="text"
                        placeholder="+ Add expense item"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addItem()}
                        style={{ flex: 1, minWidth: 0, background: '#111827', border: '1px solid #374151', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#d1d5db', outline: 'none' }}
                      />
                      <Button size="small" variant="contained" onClick={addItem} sx={{ minWidth: 0, px: 1.5, fontSize: 12 }}>Add</Button>
                    </Box>
                  </TableCell>
                  {months.map(ym => <TableCell key={ym} />)}
                  <TableCell />
                </TableRow>
              )}

              {/* Saving row */}
              <TableRow sx={{ bgcolor: '#0f172a', borderTop: '2px solid #374151' }}>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: '#111827', borderRight: '1px solid #374151', fontWeight: 600, color: 'text.primary', fontSize: 13 }}>
                  {activeCurrency === 'CAD' ? 'Remaining' : 'Saving'}
                </TableCell>
                {months.map(ym => {
                  const s = getSaving(ym)
                  return (
                    <TableCell key={ym} align="right" sx={{ fontWeight: 600, color: s > 0 ? 'success.main' : s < 0 ? 'error.main' : 'text.disabled' }}>
                      {getMonth(ym).salary === 0 && s === 0
                        ? <span style={{ color: '#374151' }}>—</span>
                        : <>{s >= 0 ? '' : '-'}{sym}{Math.abs(s).toLocaleString()}</>
                      }
                    </TableCell>
                  )
                })}
                {!isReadOnly && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
