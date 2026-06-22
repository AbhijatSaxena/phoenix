import { useMemo, useRef, useState, useEffect } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined'
import * as dagre from '@dagrejs/dagre'
import type { Todo } from '../types'
import { getPendingBlockers } from '../utils/todoUtils'

const NODE_W = 220
const NODE_H = 90

interface LayoutNode {
  todo: Todo
  x: number
  y: number
  blocked: boolean
  pendingDepsCount: number
}

interface Edge {
  source: string
  target: string
  done: boolean
  points: { x1: number; y1: number; x2: number; y2: number }
}

function buildLayout(todos: Todo[]): { nodes: LayoutNode[]; edges: Edge[]; width: number; height: number } {
  const activeTodos = todos.filter(t => !t.done)
  const doneTodos   = todos.filter(t => t.done)

  // Done todos still referenced by active todos stay in dagre (they're prerequisites)
  const activeDepsSet = new Set(activeTodos.flatMap(t => t.dependsOn ?? []))
  const pendingDone  = doneTodos.filter(t => activeDepsSet.has(t.id))
  const orphanDone   = doneTodos.filter(t => !activeDepsSet.has(t.id))
  const dagreTodos   = [...activeTodos, ...pendingDone]

  // Identify active todos that participate in a dependency chain
  const activeHasDeps = new Set(
    activeTodos.filter(t => (t.dependsOn ?? []).some(id => activeTodos.some(x => x.id === id))).map(t => t.id)
  )
  const activeIsDep = new Set(
    activeTodos.filter(t => activeTodos.some(x => (x.dependsOn ?? []).includes(t.id))).map(t => t.id)
  )
  const connectedActiveIds = new Set([...activeHasDeps, ...activeIsDep])
  const connectedActive    = activeTodos.filter(t => connectedActiveIds.has(t.id))
  const independentActive  = activeTodos.filter(t => !connectedActiveIds.has(t.id))

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 80, nodesep: 50, marginx: 40, marginy: 40 })

  dagreTodos.forEach(t => g.setNode(t.id, { width: NODE_W, height: NODE_H }))
  dagreTodos.forEach(t =>
    (t.dependsOn ?? []).forEach(depId => {
      if (dagreTodos.find(x => x.id === depId)) g.setEdge(depId, t.id)
    })
  )

  // Virtual separator node: pushes independent active todos below the dependency chains
  if (connectedActive.length > 0 && independentActive.length > 0) {
    g.setNode('__sep__', { width: 1, height: 1 })
    connectedActive.forEach(t => {
      if (!activeTodos.some(x => (x.dependsOn ?? []).includes(t.id)))
        g.setEdge(t.id, '__sep__')
    })
    independentActive.forEach(t => g.setEdge('__sep__', t.id))
  }

  dagre.layout(g)

  const dagreNodes: LayoutNode[] = dagreTodos.map(t => {
    const pos = g.node(t.id)
    const pending = getPendingBlockers(t, todos)
    return { todo: t, x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2, blocked: pending.length > 0, pendingDepsCount: pending.length }
  })

  // Place orphan done todos in a grid below all dagre nodes
  const dagreMaxY = dagreNodes.length > 0 ? Math.max(...dagreNodes.map(n => n.y + NODE_H)) : 0
  const dagreMaxX = dagreNodes.length > 0 ? Math.max(...dagreNodes.map(n => n.x + NODE_W)) + 40 : 600

  const orphanStartY = dagreMaxY + (dagreTodos.length > 0 ? 80 : 40)
  const orphanPerRow = Math.max(1, Math.floor(Math.max(dagreMaxX, 600) / (NODE_W + 30)))

  const orphanNodes: LayoutNode[] = orphanDone.map((t, i) => ({
    todo: t,
    x: 40 + (i % orphanPerRow) * (NODE_W + 30),
    y: orphanStartY + Math.floor(i / orphanPerRow) * (NODE_H + 30),
    blocked: false,
    pendingDepsCount: 0,
  }))

  const nodes = [...dagreNodes, ...orphanNodes]
  const allMaxY = nodes.length > 0 ? Math.max(...nodes.map(n => n.y + NODE_H)) + 40 : 400
  const allMaxX = nodes.length > 0 ? Math.max(...nodes.map(n => n.x + NODE_W)) + 40 : 600

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

  return { nodes, edges, width: Math.max(allMaxX, 600), height: Math.max(allMaxY, 400) }
}

interface NodeCardProps {
  node: LayoutNode
  onClick: (todo: Todo) => void
}

function NodeCard({ node, onClick }: NodeCardProps) {
  const { todo, x, y, blocked, pendingDepsCount } = node
  const status = todo.done ? 'done' : blocked ? 'blocked' : 'available'
  const accentColor = status === 'done' ? '#374151' : status === 'blocked' ? '#7c3f3f' : '#22c55e'
  const borderColor = status === 'done' ? '#1f2937' : status === 'blocked' ? '#3d1f1f' : '#14532d'
  const statusLabel = status === 'done' ? '✓ Done' : status === 'blocked' ? '🔒 Blocked' : '● Ready'
  const statusColor = status === 'done' ? '#6b7280' : status === 'blocked' ? '#7c3f3f' : '#4ade80'

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
        bgcolor: status === 'done' ? '#0d1117' : status === 'blocked' ? '#0d0808' : '#031a0e',
        opacity: status === 'done' ? 0.65 : status === 'blocked' ? 0.7 : 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: '10px 12px',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        boxShadow: status === 'available' ? '0 0 12px rgba(34,197,94,0.18), 0 0 0 1px rgba(34,197,94,0.12)' : 'none',
        '&:hover': {
          boxShadow: status === 'available'
            ? '0 0 20px rgba(34,197,94,0.3), 0 0 0 2px rgba(34,197,94,0.4)'
            : `0 0 0 2px ${accentColor}55`,
        },
        userSelect: 'none',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontSize: 12,
          lineHeight: 1.45,
          color: status === 'done' ? '#6b7280' : status === 'blocked' ? '#6b7280' : '#f0fdf4',
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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {pendingDepsCount > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: '#a78bfa' }}>
              <LockOutlinedIcon sx={{ fontSize: 11 }} />
              <Typography sx={{ fontSize: 10, lineHeight: 1, fontWeight: 600 }}>{pendingDepsCount}</Typography>
            </Box>
          )}
          {(todo.commentCount ?? 0) > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, color: '#93c5fd' }}>
              <CommentOutlinedIcon sx={{ fontSize: 11 }} />
              <Typography sx={{ fontSize: 10, lineHeight: 1, fontWeight: 600 }}>{todo.commentCount}</Typography>
            </Box>
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
  const [containerSize, setContainerSize] = useState({ w: 0, h: 520 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.offsetWidth, h: window.innerHeight - 180 })
    })
    ro.observe(el)
    setContainerSize({ w: el.offsetWidth, h: window.innerHeight - 180 })
    return () => ro.disconnect()
  }, [])

  const { nodes, edges, width, height } = useMemo(() => buildLayout(todos), [todos])

  // Scale down to fit container width on small screens; never upscale
  const scale = containerSize.w > 0 && width > containerSize.w
    ? containerSize.w / width
    : 1

  return (
    <Box
      ref={containerRef}
      sx={{
        height: Math.max(containerSize.h, 520),
        border: '1px solid #1f2937',
        borderRadius: 2,
        bgcolor: '#030712',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      {/*
        Spacer sized to scaled dimensions so scrollbars reflect real scroll area.
        The transform wrapper inside is the actual graph content scaled via CSS.
      */}
      <div style={{ width: width * scale, height: height * scale, position: 'relative', flexShrink: 0 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0, width, height }}>

          {/* SVG edges — behind nodes */}
          <svg
            style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'none', overflow: 'visible' }}
          >
            <defs>
              <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#16a34a" />
              </marker>
              <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#7c3f3f" />
              </marker>
            </defs>

            {edges.map(e => {
              const { x1, y1, x2, y2 } = e.points
              const mid1y = y1 + (y2 - y1) * 0.4
              const mid2y = y1 + (y2 - y1) * 0.6
              const d = `M ${x1} ${y1} C ${x1} ${mid1y}, ${x2} ${mid2y}, ${x2} ${y2}`
              const color = e.done ? '#16a34a' : '#7c3f3f'
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

        </div>
      </div>
    </Box>
  )
}
