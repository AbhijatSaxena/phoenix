import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  resolve: (val: boolean) => void
}

let _show: (opts: ConfirmOptions) => Promise<boolean> = () => Promise.resolve(false)

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return _show(opts)
}

export function ConfirmProvider() {
  const [state, setState] = useState<ConfirmState | null>(null)

  _show = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setState({ ...opts, resolve })
    })
  }, [])

  if (!state) return null

  function respond(val: boolean) {
    state!.resolve(val)
    setState(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">{state.title ?? 'Confirm'}</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-gray-300 text-sm">{state.message}</p>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button
            onClick={() => respond(true)}
            className={`flex-1 font-medium px-4 py-2 rounded-lg text-sm transition-colors ${
              state.danger !== false
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {state.confirmLabel ?? 'Delete'}
          </button>
          <button
            onClick={() => respond(false)}
            className="flex-1 btn-ghost text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
