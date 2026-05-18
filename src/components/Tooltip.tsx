import { useRef, useState } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
}

/**
 * Wraps children with a hover tooltip. Only renders the tooltip when content
 * is non-empty. Positions above by default, flips below if too close to top.
 */
export default function Tooltip({ content, children, className = '' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [below, setBelow] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  if (!content) return <span className={className}>{children}</span>

  function handleMouseEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setBelow(rect.top < 60)
    }
    setVisible(true)
  }

  return (
    <span
      ref={ref}
      className={`relative inline-block max-w-full ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          className={`pointer-events-none absolute z-[100] ${
            below ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          } left-0 bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1.5
          whitespace-normal break-words max-w-[240px] shadow-xl leading-snug`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
