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

const SYSTEM_PROMPT = (todoContext: string) => `You are a todo manager assistant. Given the user's request and the current todo list, decide what actions to take and return a JSON response.

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

Rules:
1. Before creating, check if a very similar todo already exists. If it does, say so and skip.
2. Dependency direction: "A needs B first" → B must be done before A → todoId=A, dependsOnId=B.
3. Use tempIds (t1, t2…) only for todos you're creating in this response.
4. Match existing todos by their text when no IDs are given.
5. If nothing should change, return an empty actions array with an explanatory message.`

export async function processTodoRequest(
  userMessage: string,
  todos: Todo[],
): Promise<AiTodoResponse> {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY
  if (!apiKey) throw new Error('VITE_GOOGLE_AI_KEY is not configured.')

  const todoContext = JSON.stringify(
    todos.map(t => ({ id: t.id, text: t.text, done: t.done, dependsOn: t.dependsOn ?? [] })),
    null, 2,
  )

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT(todoContext) }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any)?.error?.message ?? `API error ${res.status}`)
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

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
