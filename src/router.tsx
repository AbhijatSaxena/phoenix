import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SnapshotsPage from './pages/SnapshotsPage'
import ExpensesPage from './pages/ExpensesPage'
import PropertyPage from './pages/PropertyPage'
import ZerodhaPage from './pages/ZerodhaPage'
import AdminPage from './pages/AdminPage'
import CarPage from './pages/CarPage'
import AccountsPage from './pages/AccountsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'accounts',  element: <AccountsPage /> },
          { path: 'snapshots', element: <SnapshotsPage /> },
          { path: 'expenses',  element: <ExpensesPage /> },
          { path: 'property',  element: <PropertyPage /> },
          { path: 'zerodha',   element: <ZerodhaPage /> },
          { path: 'car',       element: <CarPage /> },
          { path: 'admin',     element: <AdminPage /> },
        ],
      },
    ],
  },
])
