import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SnapshotsPage from './pages/SnapshotsPage'
import ExpensesPage from './pages/ExpensesPage'
import RegentPage from './pages/RegentPage'
import ZerodhaPage from './pages/ZerodhaPage'
import TodosPage from './pages/TodosPage'

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
          { path: 'snapshots', element: <SnapshotsPage /> },
          { path: 'expenses',  element: <ExpensesPage /> },
          { path: 'regent',    element: <RegentPage /> },
          { path: 'zerodha',   element: <ZerodhaPage /> },
          { path: 'todos',     element: <TodosPage /> },
        ],
      },
    ],
  },
])
