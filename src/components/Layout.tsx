import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Chip, Tooltip, BottomNavigation, BottomNavigationAction,
  Paper, IconButton,
} from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useRatesStore } from '../store/ratesStore'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

// Items always visible in the mobile bottom bar
const primaryNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◈',  adminOnly: false },
  { to: '/accounts',  label: 'Accounts',  icon: '💼', adminOnly: false },
  { to: '/snapshots', label: 'Snapshots', icon: '📈', adminOnly: false },
  { to: '/expenses',  label: 'Expenses',  icon: '💸', adminOnly: false },
]

// Items revealed via the "More" bottom drawer on mobile
const overflowNavItems = [
  { to: '/property', label: 'Property', icon: '🏠', adminOnly: false },
  { to: '/zerodha',  label: 'Zerodha',  icon: '📊', adminOnly: false },
  { to: '/car',      label: 'Car',      icon: '🚗', adminOnly: false },
  { to: '/admin',    label: 'Admin',    icon: '🔐', adminOnly: true  },
]

const allNavItems = [...primaryNavItems, ...overflowNavItems]

const SIDEBAR_W = 200

export default function Layout() {
  const rates = useRatesStore(s => s.rates)
  const { user, role, signOut } = useAuthStore()
  const { mode, toggleMode } = useThemeStore()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleOverflow = overflowNavItems.filter(n => !n.adminOnly || role === 'admin')
  const isMoreActive = visibleOverflow.some(n => location.pathname.startsWith(n.to))

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar (desktop) */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: SIDEBAR_W,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_W,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Brand */}
        <Box sx={{ px: 2.5, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>
            Personal Management
          </Typography>
          {rates ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              USD {rates.usdInr} · CAD {rates.cadInr}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>Fetching rates…</Typography>
          )}
        </Box>

        {/* Nav links */}
        <List sx={{ flex: 1, px: 1, py: 1.5 }} disablePadding>
          {allNavItems.filter(n => !n.adminOnly || role === 'admin').map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <ListItem disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton
                    selected={isActive}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                      minHeight: 36,
                      '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28, fontSize: 16 }}>{icon}</ListItemIcon>
                    <ListItemText
                      primary={label}
                      slotProps={{
                        primary: {
                          sx: { fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'white' : 'text.secondary' },
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )}
            </NavLink>
          ))}
        </List>

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Tooltip title={user?.email ?? ''} placement="top">
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11, flex: 1, minWidth: 0 }}>
                {user?.email}
              </Typography>
            </Tooltip>
            <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              <IconButton size="small" onClick={toggleMode} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' }, p: 0.5 }}>
                {mode === 'dark'
                  ? <LightModeIcon sx={{ fontSize: 15 }} />
                  : <DarkModeIcon sx={{ fontSize: 15 }} />}
              </IconButton>
            </Tooltip>
          </Box>
          {role === 'viewer' && (
            <Chip label="View only" size="small" color="warning" variant="outlined" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
          )}
          <Box
            component="button"
            onClick={() => signOut()}
            sx={{ display: 'block', mt: 0.75, color: 'text.disabled', cursor: 'pointer', background: 'none', border: 'none', p: 0, fontSize: 11, '&:hover': { color: 'text.secondary' } }}
          >
            Sign out
          </Box>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          overflowY: 'auto',
          bgcolor: 'background.default',
          p: { xs: 2, md: 3 },
          pb: { xs: '72px', md: 3 },
        }}
      >
        {/* Mobile header */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: 13 }}>
              Personal Management
            </Typography>
            {rates && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                USD {rates.usdInr} · CAD {rates.cadInr}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
              <IconButton size="small" onClick={toggleMode} sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                {mode === 'dark'
                  ? <LightModeIcon sx={{ fontSize: 18 }} />
                  : <DarkModeIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
            {role === 'viewer' && (
              <Chip label="View only" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
            )}
            <Box
              component="button"
              onClick={() => signOut()}
              sx={{ color: 'text.disabled', cursor: 'pointer', background: 'none', border: 'none', p: 0, fontSize: 11, '&:hover': { color: 'text.secondary' } }}
            >
              Sign out
            </Box>
          </Box>
        </Box>

        <Outlet />
      </Box>

      {/* Bottom nav (mobile) — 4 primary tabs + More */}
      <Paper
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 100,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
        elevation={0}
      >
        <BottomNavigation sx={{ bgcolor: 'transparent', height: 56 }}>
          {primaryNavItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={{ textDecoration: 'none', flex: 1 }}>
              {({ isActive }) => (
                <BottomNavigationAction
                  label={label}
                  icon={<span style={{ fontSize: 18 }}>{icon}</span>}
                  sx={{
                    color: isActive ? 'primary.main' : 'text.disabled',
                    minWidth: 0,
                    '& .MuiBottomNavigationAction-label': { fontSize: 9 },
                  }}
                />
              )}
            </NavLink>
          ))}
          <BottomNavigationAction
            label="More"
            icon={<MoreHorizIcon sx={{ fontSize: 22 }} />}
            onClick={() => setMoreOpen(true)}
            sx={{
              flex: 1,
              minWidth: 0,
              color: isMoreActive ? 'primary.main' : 'text.disabled',
              '& .MuiBottomNavigationAction-label': { fontSize: 9 },
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* "More" bottom drawer (mobile) */}
      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        sx={{ display: { xs: 'block', md: 'none' } }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.paper',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            },
          },
        }}
      >
        {/* Drag handle */}
        <Box sx={{ width: 36, height: 4, bgcolor: 'divider', borderRadius: 2, mx: 'auto', mt: 1.5, mb: 0.5 }} />
        <List sx={{ px: 1, pt: 0.5, pb: 2 }} disablePadding>
          {visibleOverflow.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              style={{ textDecoration: 'none' }}
              onClick={() => setMoreOpen(false)}
            >
              {({ isActive }) => (
                <ListItem disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton
                    selected={isActive}
                    sx={{
                      borderRadius: 2,
                      py: 1.25,
                      '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 38, fontSize: 20 }}>{icon}</ListItemIcon>
                    <ListItemText
                      primary={label}
                      slotProps={{
                        primary: {
                          sx: { fontSize: 15, fontWeight: isActive ? 600 : 400, color: isActive ? 'white' : 'text.primary' },
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              )}
            </NavLink>
          ))}
        </List>
      </Drawer>
    </Box>
  )
}
