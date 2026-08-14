import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, Paper, CircularProgress, Chip, IconButton,
} from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import SavingsIcon from '@mui/icons-material/Savings'
import { fetchMonthExpenses } from '../services/firebase'
import type { Currency, MonthExpenses } from '../types'
import { useRatesStore } from '../store/ratesStore'
import { fmtINR } from '../lib/fmt'

const CURRENCY_COLOR: Record<Currency, string> = { INR: '#34d399', USD: '#60a5fa', CAD: '#f472b6' }

function currentYearMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[parseInt(m) - 1]} ${y}`
}

interface SummaryTileProps {
  label: string
  value: number
  color: string
  sub?: string
  icon: React.ReactNode
}

function SummaryTile({ label, value, color, sub, icon }: SummaryTileProps) {
  return (
    <Paper elevation={0} sx={{ flex: 1, p: { xs: 1.5, sm: 2 }, border: '1px solid var(--border-main)', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
        <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color, fontSize: { xs: 16, sm: 20 } }}>
        ₹{fmtINR(Math.abs(value))}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>{sub}</Typography>
      )}
    </Paper>
  )
}

export default function BudgetView() {
  const rates = useRatesStore(s => s.rates)
  const [month, setMonth] = useState(currentYearMonth())
  const monthInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Record<Currency, MonthExpenses | null>>({ INR: null, USD: null, CAD: null })

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchMonthExpenses('INR', month),
      fetchMonthExpenses('USD', month),
      fetchMonthExpenses('CAD', month),
    ]).then(([inr, usd, cad]) => {
      setData({ INR: inr as MonthExpenses | null, USD: usd as MonthExpenses | null, CAD: cad as MonthExpenses | null })
      setLoading(false)
    })
  }, [month])

  const toINR = (amount: number, cur: Currency) =>
    cur === 'USD' ? amount * usdInr : cur === 'CAD' ? amount * cadInr : amount

  const salary = (cur: Currency) => data[cur]?.salary ?? 0
  const expenses = (cur: Currency) => (data[cur]?.items ?? []).reduce((s, i) => s + i.amount, 0)

  const totalInflow  = toINR(salary('INR'), 'INR') + toINR(salary('USD'), 'USD') + toINR(salary('CAD'), 'CAD')
  const totalOutflow = toINR(expenses('INR'), 'INR') + toINR(expenses('USD'), 'USD') + toINR(expenses('CAD'), 'CAD')
  const remaining    = totalInflow - totalOutflow
  const burnPct      = totalInflow > 0 ? Math.min(totalOutflow / totalInflow, 1) : 0
  const savingsPct   = totalInflow > 0 ? Math.max(0, Math.round((remaining / totalInflow) * 100)) : 0

  // All expense items from all currencies sorted by INR equivalent desc
  const allItems = (['INR', 'USD', 'CAD'] as Currency[])
    .flatMap(cur => (data[cur]?.items ?? []).map(i => ({ ...i, cur, inr: toINR(i.amount, cur) })))
    .filter(i => i.amount > 0)
    .sort((a, b) => b.inr - a.inr)

  const hasAnyData = totalInflow > 0 || totalOutflow > 0

  const burnColor = burnPct > 0.9 ? '#ef4444' : burnPct > 0.7 ? '#f59e0b' : '#34d399'

  return (
    <Box>
      {/* Month navigator */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
        <IconButton size="small" onClick={() => setMonth(prevMonth(month))} sx={{ color: 'text.secondary' }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
        </IconButton>

        {/* Clickable label — opens native month/year picker */}
        <Box
          sx={{ position: 'relative', cursor: 'pointer', borderRadius: 1, px: 1.5, py: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
          onClick={() => { (monthInputRef.current as any)?.showPicker?.(); monthInputRef.current?.click() }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 160, textAlign: 'center', userSelect: 'none' }}>
            {monthLabel(month)}
          </Typography>
          <input
            ref={monthInputRef}
            type="month"
            value={month}
            max={currentYearMonth()}
            onChange={e => e.target.value && setMonth(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
          />
        </Box>

        <IconButton
          size="small"
          onClick={() => setMonth(nextMonth(month))}
          disabled={month >= currentYearMonth()}
          sx={{ color: 'text.secondary' }}
        >
          <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>
      ) : !hasAnyData ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.disabled">No data for {monthLabel(month)}</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
            Add salary and expense entries in the INR / USD / CAD tabs
          </Typography>
        </Box>
      ) : (
        <>
          {/* Summary tiles */}
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.5 }, mb: 2.5 }}>
            <SummaryTile
              label="Inflow"
              value={totalInflow}
              color="#34d399"
              sub={rates ? `at ₹${usdInr}/$ · ₹${cadInr}/C$` : undefined}
              icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
            />
            <SummaryTile
              label="Outflow"
              value={totalOutflow}
              color="#f87171"
              icon={<TrendingDownIcon sx={{ fontSize: 16 }} />}
            />
            <SummaryTile
              label="Remaining"
              value={remaining}
              color={remaining >= 0 ? '#60a5fa' : '#ef4444'}
              sub={totalInflow > 0 ? `${savingsPct}% saved` : undefined}
              icon={<SavingsIcon sx={{ fontSize: 16 }} />}
            />
          </Box>

          {/* Burn rate bar */}
          {totalInflow > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Spent</Typography>
                <Typography variant="caption" sx={{ color: burnColor, fontWeight: 600 }}>
                  {Math.round(burnPct * 100)}% of income
                </Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'var(--border-main)', overflow: 'hidden' }}>
                <Box sx={{
                  height: '100%',
                  width: `${burnPct * 100}%`,
                  borderRadius: 4,
                  bgcolor: burnColor,
                  transition: 'width 0.4s ease',
                }} />
              </Box>
            </Box>
          )}

          {/* Inflow breakdown */}
          {(salary('INR') > 0 || salary('USD') > 0 || salary('CAD') > 0) && (
            <Paper elevation={0} sx={{ border: '1px solid var(--border-main)', borderRadius: 2, overflow: 'hidden', mb: 2.5 }}>
              <Box sx={{ px: 2, py: 1.25, bgcolor: 'var(--surface-card)', borderBottom: '1px solid var(--border-main)' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: 'text.secondary' }}>
                  Inflow breakdown
                </Typography>
              </Box>
              {(['INR', 'USD', 'CAD'] as Currency[]).map(cur => {
                const s = salary(cur)
                if (!s) return null
                const inr = toINR(s, cur)
                return (
                  <Box key={cur} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid var(--border-main)', '&:last-child': { borderBottom: 'none' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={cur} size="small" sx={{ height: 18, fontSize: 10, bgcolor: CURRENCY_COLOR[cur] + '22', color: CURRENCY_COLOR[cur], fontWeight: 600, border: `1px solid ${CURRENCY_COLOR[cur]}44` }} />
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                        {cur === 'USD' ? `$${s.toLocaleString()}` : cur === 'CAD' ? `C$${s.toLocaleString()}` : `₹${s.toLocaleString()}`}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#34d399', fontSize: 13 }}>
                      ₹{fmtINR(inr)}
                    </Typography>
                  </Box>
                )
              })}
            </Paper>
          )}

          {/* Expense breakdown */}
          {allItems.length > 0 && (
            <Paper elevation={0} sx={{ border: '1px solid var(--border-main)', borderRadius: 2, overflow: 'hidden', mb: 1.5 }}>
              <Box sx={{ px: 2, py: 1.25, bgcolor: 'var(--surface-card)', borderBottom: '1px solid var(--border-main)' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: 'text.secondary' }}>
                  Expense breakdown
                </Typography>
              </Box>
              {allItems.map((item, i) => {
                const sharePct = totalOutflow > 0 ? (item.inr / totalOutflow) * 100 : 0
                const nativeLabel = item.cur === 'USD' ? `$${item.amount.toLocaleString()}`
                  : item.cur === 'CAD' ? `C$${item.amount.toLocaleString()}`
                  : `₹${item.amount.toLocaleString()}`
                return (
                  <Box key={`${item.cur}-${item.name}-${i}`} sx={{ px: 2, py: 1.25, borderBottom: i < allItems.length - 1 ? '1px solid var(--border-main)' : 'none' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontSize: 13 }}>{item.name}</Typography>
                        {item.cur !== 'INR' && (
                          <Chip label={item.cur} size="small" sx={{ height: 16, fontSize: 9, bgcolor: CURRENCY_COLOR[item.cur] + '22', color: CURRENCY_COLOR[item.cur], fontWeight: 600, border: `1px solid ${CURRENCY_COLOR[item.cur]}44` }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                        {item.cur !== 'INR' && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>{nativeLabel}</Typography>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>₹{fmtINR(item.inr)}</Typography>
                      </Box>
                    </Box>
                    {/* Mini bar showing this item's share */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, height: 3, borderRadius: 2, bgcolor: 'var(--border-main)', overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${sharePct}%`, bgcolor: CURRENCY_COLOR[item.cur], borderRadius: 2 }} />
                      </Box>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, minWidth: 28, textAlign: 'right' }}>
                        {Math.round(sharePct)}%
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
              <Box sx={{ px: 2, py: 1.25, bgcolor: 'var(--surface-card)', borderTop: '1px solid var(--border-main)', display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Total outflow</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#f87171' }}>₹{fmtINR(totalOutflow)}</Typography>
              </Box>
            </Paper>
          )}

          {/* Savings nudge */}
          {totalInflow > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              {savingsPct >= 20
                ? `Great discipline — you're saving ${savingsPct}% this month.`
                : savingsPct > 0
                ? `You're saving ${savingsPct}% this month. Aim for 20%+.`
                : remaining < 0
                ? 'Spending exceeds income this month.'
                : 'No income recorded yet for this month.'}
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}
