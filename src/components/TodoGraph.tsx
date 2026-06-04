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

const NODE_W = 240
const NODE_H = 96

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50 })
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

  const borderColor =
    status === 'done'      ? '#374151' :
    status === 'blocked'   ? '#7f1d1d' :
                             '#1d4ed8'

  const bgColor =
    status === 'done'      ? '#111827' :
    status === 'blocked'   ? '#0f0a0a' :
                             '#0f172a'

  return (
    <div
      style={{
        width: NODE_W,
        height: NODE_H,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        borderLeft: `4px solid ${status === 'done' ? '#374151' : status === 'blocked' ? '#dc2626' : '#3b82f6'}`,
        opacity: status === 'done' ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 12px',
        boxShadow: status === 'available' ? '0 0 0 1px rgba(59,130,246,0.15)' : 'none',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#4b5563', width: 8, height: 8, top: -5 }}
      />

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button
          onClick={() => status !== 'blocked' && onToggle(todo)}
          title={blocked ? 'Complete dependencies first' : undefined}
          style={{
            flexShrink: 0,
            width: 16,
            height: 16,
            marginTop: 2,
            borderRadius: 4,
            border: `1.5px solid ${todo.done ? '#2563eb' : blocked ? '#374151' : '#6b7280'}`,
            background: todo.done ? '#2563eb' : 'transparent',
            cursor: blocked && !todo.done ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: blocked && !todo.done ? 0.4 : 1,
          }}
        >
          {todo.done && <span style={{ fontSize: 9, color: '#fff', lineHeight: 1 }}>✓</span>}
        </button>
        <span style={{
          flex: 1,
          fontSize: 12,
          lineHeight: 1.4,
          color: status === 'done' ? '#6b7280' : status === 'blocked' ? '#6b7280' : '#e5e7eb',
          textDecoration: todo.done ? 'line-through' : 'none',
          wordBreak: 'break-word',
        }}>
          {todo.text}
        </span>
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: status === 'done' ? '#4b5563' : status === 'blocked' ? '#dc2626' : '#3b82f6',
        }}>
          {status === 'done' ? '✓ DONE' : status === 'blocked' ? '🔒 BLOCKED' : '● READY'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onManageDeps(todo)}
            title="Manage dependencies"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#7c3aed', opacity: 0.7 }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
          <button
            onClick={() => onComment(todo)}
            title="Comments"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: (todo.commentCount ?? 0) > 0 ? '#3b82f6' : '#4b5563',
              display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {(todo.commentCount ?? 0) > 0 && (
              <span style={{ fontSize: 9, color: '#3b82f6' }}>{todo.commentCount}</span>
            )}
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#4b5563', width: 8, height: 8, bottom: -5 }}
      />
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
          style: { stroke: color, strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
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
    <div style={{ height: 'calc(100vh - 180px)', minHeight: 520 }}
      className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background color="#1e293b" gap={28} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
