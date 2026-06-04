import { useState, useCallback } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography,
} from '@mui/material'

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

  function respond(val: boolean) {
    state!.resolve(val)
    setState(null)
  }

  return (
    <Dialog open={!!state} onClose={() => state && respond(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{state?.title ?? 'Confirm'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">{state?.message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => respond(false)} color="inherit">Cancel</Button>
        <Button
          onClick={() => respond(true)}
          variant="contained"
          color={state?.danger !== false ? 'error' : 'primary'}
        >
          {state?.confirmLabel ?? 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
