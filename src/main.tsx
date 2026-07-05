import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import App from './App'
import { useThemeStore } from './store/themeStore'

function createAppTheme(mode: 'dark' | 'light') {
  const dark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      background: {
        default: dark ? '#030712' : '#f8fafc',
        paper:   dark ? '#111827' : '#ffffff',
      },
      primary: { main: '#2563eb' },
      success: { main: '#10b981' },
      error:   { main: '#ef4444' },
      warning: { main: '#f59e0b' },
      text: {
        primary:   dark ? '#f3f4f6' : '#111827',
        secondary: dark ? '#9ca3af' : '#6b7280',
      },
      divider: dark ? '#1f2937' : '#e2e8f0',
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 13,
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          :root {
            --surface-card:   ${dark ? '#0f172a' : '#f1f5f9'};
            --surface-deep:   ${dark ? '#0a0f1a' : '#e8edf5'};
            --border-main:    ${dark ? '#1f2937' : '#e2e8f0'};
            --border-subtle:  ${dark ? '#374151' : '#d1d5db'};
            --chart-grid:     ${dark ? '#1f2937' : '#e2e8f0'};
            --chart-axis:     ${dark ? '#6b7280' : '#9ca3af'};
          }
        `,
      },
      MuiButton: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#374151' : '#d1d5db' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#6b7280' : '#9ca3af' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: dark ? '#1f2937' : '#e2e8f0' },
          head: { color: dark ? '#9ca3af' : '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' },
        },
      },
    },
  })
}

function ThemedApp() {
  const { mode } = useThemeStore()
  const theme = useMemo(() => createAppTheme(mode), [mode])
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>,
)
