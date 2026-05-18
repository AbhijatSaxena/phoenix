export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-4 h-4 border-2' : 'w-8 h-8 border-2'
  return (
    <div className={`${cls} border-blue-500 border-t-transparent rounded-full animate-spin`} />
  )
}
