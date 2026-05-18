import { NavLink, Outlet } from 'react-router-dom'
import { useRatesStore } from '../store/ratesStore'
import { useAuthStore } from '../store/authStore'
import Tooltip from './Tooltip'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '◈' },
  { to: '/snapshots', label: 'Snapshots', icon: '📈' },
  { to: '/expenses',  label: 'Expenses',  icon: '💸' },
  { to: '/regent',    label: 'Regent',    icon: '🏠' },
  { to: '/zerodha',   label: 'Zerodha',   icon: '📊' },
  { to: '/todos',     label: 'Todos',     icon: '✅' },
]

export default function Layout() {
  const rates = useRatesStore(s => s.rates)
  const { user, role, signOut } = useAuthStore()

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Sidebar (desktop only) ───────────────────────────────────────── */}
      <aside className="hidden md:flex w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-base font-bold text-white tracking-tight">Personal Finance</h1>
          {rates ? (
            <p className="text-[11px] text-gray-500 mt-1">USD {rates.usdInr} · CAD {rates.cadInr}</p>
          ) : (
            <p className="text-[11px] text-gray-600 mt-1">Fetching rates…</p>
          )}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-800 space-y-2">
          <Tooltip content={user?.email ?? ''}>
            <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
          </Tooltip>
          {role === 'viewer' && (
            <span className="inline-block text-[10px] text-amber-500 border border-amber-800 px-1.5 py-0.5 rounded">
              View only
            </span>
          )}
          <button
            onClick={() => signOut()}
            className="block text-[11px] text-gray-600 hover:text-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-gray-950 p-4 md:p-6 pb-20 md:pb-6">
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <div>
            <h1 className="text-sm font-bold text-white">Personal Finance</h1>
            {rates ? (
              <p className="text-[10px] text-gray-500">USD {rates.usdInr} · CAD {rates.cadInr}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {role === 'viewer' && (
              <span className="text-[10px] text-amber-500 border border-amber-800 px-1.5 py-0.5 rounded">
                View only
              </span>
            )}
            <button
              onClick={() => signOut()}
              className="text-[11px] text-gray-500 hover:text-gray-300"
            >
              Sign out
            </button>
          </div>
        </div>

        <Outlet />
      </main>

      {/* ── Bottom tab bar (mobile only) ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-600'
              }`
            }
          >
            <span className="text-lg leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
