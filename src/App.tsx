import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useRatesStore } from './store/ratesStore'
import { useAuthStore } from './store/authStore'
import { ConfirmProvider } from './components/ConfirmDialog'

export default function App() {
  const loadRates = useRatesStore(s => s.loadRates)
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    if (user) loadRates()
  }, [user])

  return (
    <>
      <RouterProvider router={router} />
      <ConfirmProvider />
    </>
  )
}
