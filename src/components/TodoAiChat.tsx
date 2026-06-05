import { useEffect, useRef, useState } from 'react'
import {
  Box, Paper, Typography, IconButton, TextField, InputAdornment,
  CircularProgress, Fab, Tooltip,
} from '@mui/material'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import type { Todo } from '../types'
import type { TodoAction, ConversationMessage } from '../services/ai'
import { processTodoRequest, summariseActions } from '../services/ai'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  done?: string[]  // action summaries
  error?: boolean
}

interface Props {
  todos: Todo[]
  onExecute: (actions: TodoAction[]) => Promise<void>
}

const SUGGESTIONS = [
  'Add "Deploy to staging" that depends on "Write tests"',
  'Mark the login todo as done',
  'Archive all completed todos',
  'Create a chain: Design → Build → Test → Ship',
]

export default function TodoAiChat({ todos, onExecute }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function send(text?: string) {
    const msg = (text ?? draft).trim()
    if (!msg || loading) return
    setDraft('')

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      // Build history from existing messages for multi-turn context
      const history: ConversationMessage[] = messages.flatMap(m => {
        const content = m.role === 'assistant'
          ? JSON.stringify({ message: m.text, actions: [] })  // assistant turn as JSON
          : m.text
        return [{ role: m.role, content }]
      })
      const result = await processTodoRequest(msg, todos, history)
      if (result.actions.length > 0) await onExecute(result.actions)
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: result.message,
        done: result.actions.length > 0 ? summariseActions(result.actions) : undefined,
      }])
    } catch (err: any) {
      const raw: string = err.message ?? ''
      const text = raw.includes('VITE_GROQ_API_KEY')
        ? 'API key not set up yet. Ask the repo owner to add VITE_GROQ_API_KEY as a GitHub Actions secret, then redeploy.'
        : raw || 'Something went wrong.'
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text,
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: { xs: 76, md: 24 },
            right: { xs: 12, md: 24 },
            width: { xs: 'calc(100vw - 24px)', sm: 370 },
            height: { xs: 460, sm: 500 },
            zIndex: 1300,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #1f2937',
            bgcolor: '#111827',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 15, color: 'primary.main' }} />
            <Typography variant="subtitle2" sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
              Todo AI
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, mr: 1 }}>
              Llama 3.3 70B
            </Typography>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {messages.length === 0 && (
              <Box>
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', pt: 2, pb: 1.5, fontSize: 12 }}>
                  Describe what you want to do with your todos…
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {SUGGESTIONS.map(s => (
                    <Box
                      key={s}
                      onClick={() => send(s)}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        border: '1px solid #1f2937',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover', borderColor: '#374151' },
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{s}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {messages.map(m => (
              <Box key={m.id} sx={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <Box
                  sx={{
                    maxWidth: '85%',
                    bgcolor: m.role === 'user' ? 'primary.main' : '#1e293b',
                    borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontSize: 12.5, color: m.error ? 'error.light' : 'text.primary', lineHeight: 1.5 }}>
                    {m.text}
                  </Typography>
                  {m.done?.map((d, i) => (
                    <Typography key={i} variant="caption" sx={{ display: 'block', color: 'success.light', fontSize: 10.5, mt: 0.5, opacity: 0.9 }}>
                      ✓ {d}
                    </Typography>
                  ))}
                </Box>
              </Box>
            ))}

            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Box sx={{ bgcolor: '#1e293b', borderRadius: '14px 14px 14px 3px', px: 1.5, py: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <CircularProgress size={10} />
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>Thinking…</Typography>
                </Box>
              </Box>
            )}
            <div ref={bottomRef} />
          </Box>

          {/* Input */}
          <Box sx={{ p: 1.5, borderTop: '1px solid #1f2937' }}>
            <TextField
              inputRef={inputRef}
              size="small"
              fullWidth
              placeholder="e.g. Add deploy todo that needs CI passing first…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              disabled={loading}
              sx={{ '& .MuiInputBase-root': { fontSize: 12.5 } }}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => send()} disabled={loading || !draft.trim()} edge="end">
                        {loading ? <CircularProgress size={14} /> : <SendIcon sx={{ fontSize: 15 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* FAB */}
      {!open && (
        <Tooltip title="Todo AI" placement="left">
          <Fab
            color="primary"
            size="medium"
            onClick={() => setOpen(true)}
            sx={{
              position: 'fixed',
              bottom: { xs: 76, md: 24 },
              right: { xs: 16, md: 24 },
              zIndex: 1300,
              boxShadow: '0 0 0 4px rgba(37,99,235,0.2)',
            }}
          >
            <AutoAwesomeIcon />
          </Fab>
        </Tooltip>
      )}
    </>
  )
}
