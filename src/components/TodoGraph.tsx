import { useMemo, useRef, useState, useEffect } from 'react'
import { Box, Paper, Typography, Chip } from '@mui/material'
import * as dagre from '@dagrejs/dagre'
import type { Todo } from '../types'

const NODE_W = 220
const NODE_H = 90

interface LayoutNode {
  todo: Todo
  x: number
  y: number
  blocked: boolean
}

interface Edge {
  source: string
  target: string
  done: boolean
  points: { x1: number; y1: number; x2: number; y2: number }
}

function buildLayout(todos: Todo[]): { nodes: LayoutNode[]; edges: Edge[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50, marginx: 40, marginy: 40 })

  todos.forEach(t => g.setNode(t.id, { width: NODE_W, height: NODE_H }))
  todos.forEach(t => (t.dependsOn ?? []).forEach(depId => {
    if (todos.find(x => x.id === depId)) g.setEdge(depId, t.id)
  }))

  dagre.layout(g)

  const isBlocked = (t: Todo) => (t.dependsOn ?? []).some(id => !todos.find(x => x.id === id)?.done)

  const nodes: LayoutNode[] = todos.map(t => {
    const pos = g.node(t.id)
    return { todo: t, x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2, blocked: isBlocked(t) }
  })

  const graphInfo = g.graph()
  const width  = (graphInfo.width  ?? 600) + 80
  const height = (graphInfo.height ?? 400) + 80

  const edges: Edge[] = todos.flatMap(t =>
    (t.dependsOn ?? []).flatMap(depId => {
      const src = nodes.find(n => n.todo.id === depId)
      const tgt = nodes.find(n => n.todo.id === t.id)
      if (!src || !tgt) return []
      const depDone = todos.find(x => x.id === depId)?.done ?? false
      return [{
        source: depId,
        target: t.id,
        done: depDone,
        points: {
          x1: src.x + NODE_W / 2,
          y1: src.y + NODE_H,
          x2: tgt.x + NODE_W / 2,
          y2: tgt.y,
        },
      }]
    })
  )

  return { nodes, edges, width, height }
}

interface NodeCardProps {
  node: LayoutNode
  onClick: (todo: Todo) => void
}

function NodeCard({ node, onClick }: NodeCardProps) {
  const { todo, x, y, blocked } = node
  const status = todo.done ? 'done' : blocked ? 'blocked' : 'available'
  const accentColor = status === 'done' ? '#374151' : status === 'blocked' ? '#dc2626' : '#2563eb'
  const borderColor = status === 'done' ? '#1f2937' : status === 'blocked' ? '#7f1d1d' : '#1e3a8a'
  const statusLabel = status === 'done' ? '✓ Done' : status === 'blocked' ? '🔒 Blocked' : '● Ready'
  const statusColor = status === 'done' ? '#6b7280' : status === 'blocked' ? '#dc2626' : '#60a5fa'

  return (
    <Paper
      onClick={() => onClick(todo)}
      elevation={0}
      sx={{
        position: 'absolute',
        left: x,
        top: y,
        width: NODE_W,
        height: NODE_H,
        cursor: 'pointer',
        border: `1.5px solid ${borderColor}`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: '10px',
        bgcolor: status === 'done' ? '#0d1117' : status === 'blocked' ? '#0f0a0a' : '#0f172a',
        opacity: status === 'done' ? 0.65 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: '10px 12px',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: status === 'available' ? '0 0 0 1px rgba(37,99,235,0.15)' : 'none',
        '&:hover': {
          boxShadow: `0 0 0 2px ${accentColor}66`,
        },
        userSelect: 'none',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontSize: 12,
          lineHeight: 1.45,
          color: status === 'done' ? '#6b7280' : status === 'blocked' ? '#9ca3af' : '#e5e7eb',
          textDecoration: todo.done ? 'line-through' : 'none',
          wordBreak: 'break-word',
          flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {todo.text}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: statusColor }}>
          {statusLabel}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          {(todo.dependsOn ?? []).length > 0 && (
            <Chip
              label={(todo.dependsOn ?? []).length}
              size="small"
              sx={{ height: 16, fontSize: 9, bgcolor: '#4c1d95', color: '#a78bfa', '& .MuiChip-label': { px: 0.75 } }}
            />
          )}
          {(todo.commentCount ?? 0) > 0 && (
            <Chip
              label={todo.commentCount}
              size="small"
              sx={{ height: 16, fontSize: 9, bgcolor: '#1e3a8a', color: '#93c5fd', '& .MuiChip-label': { px: 0.75 } }}
            />
          )}
        </Box>
      </Box>
    </Paper>
  )
}

interface Props {
  todos: Todo[]
  onSelect: (todo: Todo) => void
}

export default function TodoGraph({ todos, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerH, setContainerH] = useState(520)

  useEffect(() => {
    function measure() {
      setContainerH(window.innerHeight - 180)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const { nodes, edges, width, height } = useMemo(() => buildLayout(todos), [todos])

  return (
    <Box
      ref={containerRef}
      sx={{
        height: Math.max(containerH, 520),
        border: '1px solid #1f2937',
        borderRadius: 2,
        bgcolor: '#030712',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      {/* SVG for edges — behind nodes */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none', overflow: 'visible' }}
      >
        <defs>
          <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#16a34a" />
          </marker>
          <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#dc2626" />
          </marker>
        </defs>

        {edges.map(e => {
          const { x1, y1, x2, y2 } = e.points
          const mid1y = y1 + (y2 - y1) * 0.4
          const mid2y = y1 + (y2 - y1) * 0.6
          const d = `M ${x1} ${y1} C ${x1} ${mid1y}, ${x2} ${mid2y}, ${x2} ${y2}`
          const color = e.done ? '#16a34a' : '#dc2626'
          return (
            <path
              key={`${e.source}-${e.target}`}
              d={d}
              stroke={color}
              strokeWidth={e.done ? 1.5 : 2}
              fill="none"
              strokeDasharray={e.done ? undefined : '5,4'}
              markerEnd={`url(#arrow-${e.done ? 'green' : 'red'})`}
              opacity={e.done ? 0.6 : 1}
            />
          )
        })}
      </svg>

      {/* Nodes */}
      <div style={{ position: 'relative', width, height }}>
        {nodes.map(node => (
          <NodeCard key={node.todo.id} node={node} onClick={onSelect} />
        ))}
      </div>
    </Box>
  )
}
