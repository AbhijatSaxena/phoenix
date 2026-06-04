import { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  type NodeProps,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as dagre from '@dagrejs/dagre'
import type { Todo } from '../types'

const NODE_W = 220
const NODE_H = 88

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 90, nodesep: 50 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const pos = g.node(n.id)
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } }
  })
}

interface NodeData extends Record<string, unknown> {
  todo: Todo
  blocked: boolean
  onToggle: (todo: Todo) => void
  onComment: (todo: Todo) => void
  onManageDeps: (todo: Todo) => void
}

function TodoNode({ data }: NodeProps) {
  const { todo, blocked, onToggle, onComment, onManageDeps } = data as NodeData
  const status = todo.done ? 'done' : blocked ? 'blocked' : 'available'

  return (
    <div
      style={{ width: NODE_W, minHeight: NODE_H }}
      className={`rounded-lg border p-3 flex flex-col gap-2 cursor-default select-none
        ${status === 'done'      ? 'bg-gray-800/50 border-gray-700/60'    : ''}
        ${status === 'blocked'   ? 'bg-gray-950 border-red-900/50'        : ''}
        ${status === 'available' ? 'bg-gray-900 border-blue-500/40'       : ''}`}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#4b5563', width: 8, height: 8 }} />

      <div className="flex items-start gap-2">
        <button
          onClick={() => status !== 'blocked' && onToggle(todo)}
          title={blocked ? 'Complete dependencies first' : undefined}
          className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors
            ${todo.done                        ? 'bg-blue-600 border-blue-600 text-white'       : ''}
            ${blocked && !todo.done            ? 'border-gray-700 cursor-not-allowed opacity-40' : ''}
            ${!todo.done && !blocked           ? 'border-gray-500 hover:border-gray-300'         : ''}`}
        >
          {todo.done && <span className="text-[10px]">✓</span>}
        </button>
        <span className={`flex-1 text-xs leading-snug
          ${status === 'done'      ? 'line-through text-gray-600' : ''}
          ${status === 'blocked'   ? 'text-gray-500'              : ''}
          ${status === 'available' ? 'text-gray-200'              : ''}`}
        >
          {todo.text}
        </span>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium
            ${status === 'done'      ? 'text-gray-600'  : ''}
            ${status === 'blocked'   ? 'text-red-800'   : ''}
            ${status === 'available' ? 'text-blue-500'  : ''}`}
          >
            {status === 'done' ? '✓ Done' : status === 'blocked' ? '🔒 Blocked' : '● Ready'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onManageDeps(todo)}
            className="text-gray-700 hover:text-purple-400 transition-colors"
            title="Manage dependencies"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button
            onClick={() => onComment(todo)}
            className={`flex items-center gap-0.5 transition-colors
              ${(todo.commentCount ?? 0) > 0 ? 'text-blue-400' : 'text-gray-700 hover:text-blue-400'}`}
            title="Comments"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {(todo.commentCount ?? 0) > 0 && (
              <span className="text-[9px]">{todo.commentCount}</span>
            )}
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#4b5563', width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { todo: TodoNode }

interface Props {
  todos: Todo[]
  onToggle: (todo: Todo) => void
  onComment: (todo: Todo) => void
  onManageDeps: (todo: Todo) => void
}

export default function TodoGraph({ todos, onToggle, onComment, onManageDeps }: Props) {
  function isBlocked(todo: Todo): boolean {
    return (todo.dependsOn ?? []).some(id => !todos.find(t => t.id === id)?.done)
  }

  const { nodes, edges } = useMemo(() => {
    const rawEdges: Edge[] = todos.flatMap(todo =>
      (todo.dependsOn ?? []).map(depId => {
        const depDone = todos.find(t => t.id === depId)?.done ?? false
        const color = depDone ? '#16a34a' : '#dc2626'
        return {
          id: `${depId}-${todo.id}`,
          source: depId,
          target: todo.id,
          animated: !depDone,
          style: { stroke: color, strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        }
      })
    )

    const rawNodes: Node[] = todos.map(todo => ({
      id: todo.id,
      type: 'todo',
      position: { x: 0, y: 0 },
      data: { todo, blocked: isBlocked(todo), onToggle, onComment, onManageDeps } as NodeData,
    }))

    return { nodes: layoutNodes(rawNodes, rawEdges), edges: rawEdges }
  }, [todos, onToggle, onComment, onManageDeps])

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="#1f2937" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex items-center gap-4 bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-[10px] text-gray-500 pointer-events-none">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />Ready</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-900 shrink-0" />Blocked</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600 shrink-0" />Done</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-px bg-red-600" />Incomplete dep</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-px bg-green-600" />Complete dep</span>
      </div>
    </div>
  )
}
