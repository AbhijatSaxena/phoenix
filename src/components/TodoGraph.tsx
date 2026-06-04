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
  onSelect: (todo: Todo) => void
}

function TodoNode({ data }: NodeProps) {
  const { todo, blocked, onSelect } = data as NodeData
  const status = todo.done ? 'done' : blocked ? 'blocked' : 'available'

  const accentColor = status === 'done' ? '#374151' : status === 'blocked' ? '#dc2626' : '#3b82f6'
  const bgColor     = status === 'done' ? '#111827' : status === 'blocked' ? '#0f0a0a' : '#0f172a'
  const borderColor = status === 'done' ? '#374151' : status === 'blocked' ? '#7f1d1d' : '#1d4ed8'

  return (
    <div
      onClick={() => onSelect(todo)}
      style={{
        width: NODE_W,
        height: NODE_H,
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 10,
        borderLeft: `4px solid ${accentColor}`,
        opacity: status === 'done' ? 0.65 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: status === 'available' ? '0 0 0 1px rgba(59,130,246,0.15)' : 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 2px ${accentColor}55` }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = status === 'available' ? '0 0 0 1px rgba(59,130,246,0.15)' : 'none' }}
    >
      <Handle type="target" position={Position.Top}    style={{ background: '#4b5563', width: 8, height: 8, top: -5 }} />

      {/* Todo text */}
      <span style={{
        fontSize: 12,
        lineHeight: 1.45,
        color: status === 'done' ? '#6b7280' : status === 'blocked' ? '#9ca3af' : '#e5e7eb',
        textDecoration: todo.done ? 'line-through' : 'none',
        wordBreak: 'break-word',
        flex: 1,
      }}>
        {todo.text}
      </span>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: accentColor }}>
          {status === 'done' ? '✓ DONE' : status === 'blocked' ? '🔒 BLOCKED' : '● READY'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(todo.dependsOn ?? []).length > 0 && (
            <span style={{ fontSize: 9, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 2 }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {(todo.dependsOn ?? []).length}
            </span>
          )}
          {(todo.commentCount ?? 0) > 0 && (
            <span style={{ fontSize: 9, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 2 }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {todo.commentCount}
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#4b5563', width: 8, height: 8, bottom: -5 }} />
    </div>
  )
}

const nodeTypes = { todo: TodoNode }

interface Props {
  todos: Todo[]
  onSelect: (todo: Todo) => void
}

export default function TodoGraph({ todos, onSelect }: Props) {
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
      data: { todo, blocked: isBlocked(todo), onSelect } as NodeData,
    }))
    return { nodes: layoutNodes(rawNodes, rawEdges), edges: rawEdges }
  }, [todos, onSelect])

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
