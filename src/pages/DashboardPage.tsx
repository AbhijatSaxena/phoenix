import { useEffect } from 'react'
import {
  Box, Grid, Paper, Typography, CircularProgress,
} from '@mui/material'
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts'
import { useDashboardStore, computeNetInr } from '../store/dashboardStore'
import { useRatesStore } from '../store/ratesStore'
import { useSnapshotStore } from '../store/snapshotStore'
import type { Category } from '../types'
import { fmtINR, isoToDisplay } from '../lib/fmt'
import { useLinksStore } from '../store/linksStore'

const CATEGORY_META: { key: Category; label: string; color: string }[] = [
  { key: 'liquid',       label: 'Liquid',       color: '#38bdf8' },
  { key: 'appreciating', label: 'Appreciating', color: '#34d399' },
  { key: 'investments',  label: 'Investments',  color: '#a78bfa' },
  { key: 'depreciating', label: 'Depreciating', color: '#fbbf24' },
]

export default function DashboardPage() {
  const { accounts, loading, load } = useDashboardStore()
  const rates = useRatesStore(s => s.rates)
  const { snapshots, load: loadSnapshots } = useSnapshotStore()
  const { links, load: loadLinks } = useLinksStore()

  useEffect(() => { load(); loadLinks(); loadSnapshots() }, [])

  const usdInr = rates?.usdInr ?? 84
  const cadInr = rates?.cadInr ?? 62

  const sectionTotal = (cat: Category) =>
    accounts.filter(a => a.category === cat).reduce((s, a) => s + computeNetInr(a, usdInr, cadInr), 0)

  const liquid       = sectionTotal('liquid')
  const appreciating = sectionTotal('appreciating')
  const investments  = sectionTotal('investments')
  const depreciating = sectionTotal('depreciating')
  const netWorth     = liquid + appreciating + investments + depreciating

  const chartData = snapshots.slice(-40).map(s => ({
    date: s.date.slice(5),
    total: Math.round(s.total / 1_00_000),
    fullDate: s.date,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const snap = snapshots.find(s => s.date.slice(5) === label)
    return (
      <Paper elevation={3} sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{snap ? isoToDisplay(snap.date) : label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>₹{payload[0].value}L</Typography>
        {snap?.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 180 }}>{snap.notes}</Typography>}
      </Paper>
    )
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box>
      {/* Quick Links */}
      {links.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {links.map(link => (
            <Box
              key={link.id}
              component="a"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.5, py: 0.75, borderRadius: '8px',
                border: '1px solid var(--border-main)',
                bgcolor: 'var(--surface-card)',
                color: 'text.secondary', textDecoration: 'none',
                fontSize: 12, fontWeight: 500,
                transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                '&:hover': { borderColor: 'primary.main', color: 'text.primary', bgcolor: 'background.paper' },
              }}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{link.emoji}</span>
              {link.title}
            </Box>
          ))}
        </Box>
      )}

      {/* Summary tiles */}
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {CATEGORY_META.map(({ key, label, color }) => (
          <Grid key={key} size={{ xs: 6 }}>
            <Paper elevation={0} sx={{ p: 2, textAlign: 'center', border: '1px solid var(--border-main)' }}>
              <Typography variant="overline" sx={{ fontSize: 10, color: 'text.secondary', display: 'block' }}>{label}</Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color }}>
                ₹{fmtINR(sectionTotal(key))}
              </Typography>
            </Paper>
          </Grid>
        ))}
        <Grid size={{ xs: 12 }}>
          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', border: '1px solid var(--border-main)' }}>
            <Typography variant="overline" sx={{ fontSize: 10, color: 'text.secondary', display: 'block' }}>Net Worth</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
              ₹{fmtINR(netWorth)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Net Worth trend chart */}
      {chartData.length > 1 && (
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid var(--border-main)' }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Net Worth over time (₹ Lakhs)</Typography>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}L`} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#60a5fa' }} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      )}

    </Box>
  )
}
