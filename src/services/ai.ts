import type { Todo } from '../types'

export interface TodoAction {
  type: 'create_todo' | 'link_dep' | 'mark_done' | 'mark_undone' | 'archive'
  text?: string
  tempId?: string
  id?: string
  todoId?: string
  dependsOnId?: string
}

export interface AiTodoResponse {
  message: string
  actions: TodoAction[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = (todoContext: string) => `You are a todo manager assistant that helps users capture well-structured todos with proper dependencies.

Current todos:
${todoContext}

Respond ONLY with valid JSON — no markdown fences, no extra text:
{"message":"...","actions":[]}

Available action types:
- {"type":"create_todo","text":"...","tempId":"t1"}
- {"type":"link_dep","todoId":"<id or tempId>","dependsOnId":"<id or tempId>"}
- {"type":"mark_done","id":"<existing id>"}
- {"type":"mark_undone","id":"<existing id>"}
- {"type":"archive","id":"<existing id>"}

## Core rules
1. Only take actions the user EXPLICITLY requests. Never mark done, archive, or link unless directly asked.
2. CRITICAL — no duplicates: Before creating any todo, scan the current todos list AND the conversation history for todos already created this session. If a todo with nearly identical purpose already exists, use its existing id — never recreate it.
3. Dependency direction: "A needs B first" → todoId=A, dependsOnId=B.
4. Use tempIds (t1, t2…) only for todos you are creating for the first time in THIS response.
5. Match existing todos by their text when no IDs are given.
6. When the user asks a question, answer using the todo data — do NOT take actions unless also asked.

## Blocker interview (most important behaviour)
When the user asks to create a NEW todo and no blockers/dependencies are mentioned:
- Do NOT create the todo yet.
- Ask a natural, conversational follow-up question. Rephrase the task as a verb phrase — never quote it verbatim. For example: "File my taxes" → "What's blocking you from filing your taxes?", "Buy a car" → "What's stopping you from buying a car?", "Call the doctor" → "Is anything blocking you from calling the doctor?"
- When the user replies with a blocker, acknowledge it briefly and ask the same style of question about that blocker: "Got it. And what's blocking you from [rephrased blocker]?"
- Keep the tone conversational and concise — one short sentence per turn.
- Continue drilling until the user says something like "nothing", "that's it", "done", "no more", or gives a clear closure signal.
- Once you have the full picture, create ALL the todos (original + every blocker uncovered) and link them as a proper dependency chain in a single response. Confirm with a short natural summary.
- If the user's original message already mentions dependencies or blockers explicitly, skip the interview and act immediately.`

export async function processTodoRequest(
  userMessage: string,
  todos: Todo[],
  history: ConversationMessage[] = [],
): Promise<AiTodoResponse> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not configured.')

  const todoContext = JSON.stringify(
    todos.map(t => ({ id: t.id, text: t.text, done: t.done, dependsOn: t.dependsOn ?? [] })),
    null, 2,
  )

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(todoContext) },
        ...history,
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.error?.message ?? `API error ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''

  try {
    return JSON.parse(text) as AiTodoResponse
  } catch {
    throw new Error(`AI returned malformed JSON: ${text}`)
  }
}

export function summariseActions(actions: TodoAction[]): string[] {
  return actions.map(a => {
    switch (a.type) {
      case 'create_todo':  return `Created "${a.text}"`
      case 'link_dep':     return `Linked dependency`
      case 'mark_done':    return `Marked as done`
      case 'mark_undone':  return `Marked as not done`
      case 'archive':      return `Archived todo`
      default:             return `Action: ${(a as any).type}`
    }
  })
}
