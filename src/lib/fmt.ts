/** Format a number as Indian locale currency, e.g. 1,23,456 */
export function fmtINR(val: number): string {
  return val.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function fmtCurrency(val: number, currency = 'INR'): string {
  if (currency === 'INR') return `₹${fmtINR(val)}`
  if (currency === 'USD') return `$${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (currency === 'CAD') return `C$${val.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
  return val.toString()
}

export function fmtDiff(val: number | null): string {
  if (val === null) return '—'
  const sign = val >= 0 ? '+' : ''
  return `${sign}₹${fmtINR(val)}`
}

export function diffClass(val: number | null): string {
  if (val === null) return 'neutral'
  return val >= 0 ? 'positive' : 'negative'
}

/** Excel serial date to JS Date */
export function excelDateToISO(serial: number): string {
  // Excel epoch is Jan 1, 1900; JS epoch is Jan 1, 1970
  const ms = (serial - 25569) * 86400 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

export function isoToDisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
}
