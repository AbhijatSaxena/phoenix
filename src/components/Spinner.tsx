import { CircularProgress } from '@mui/material'

export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return <CircularProgress size={size === 'sm' ? 16 : 32} />
}
