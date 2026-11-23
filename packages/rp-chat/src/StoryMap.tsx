import { useMemo } from 'react';
import {
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import flowStyles from '@xyflow/react/dist/style.css?inline';
import type { TurnSummary } from './protocol.js';

export interface StoryMapProps {
  rows: TurnSummary[];
  currentTurnId?: string;
  onPreview(turnId: string, candidateId?: string): void;
}

type TurnNode = Node<{
  row: TurnSummary;
  depth: number;
  current: boolean;
  onRoute: boolean;
  onPreview(turnId: string, candidateId?: string): void;
}, 'turn'>;

const NODE_WIDTH = 232;
const NODE_HEIGHT = 116;
const FIT_OPTIONS = { padding: 0.18, maxZoom: 1 };

const MAP_STYLES = `
.tk-story-map { min-width: 0; overflow: hidden; border: 1px solid var(--tk-border, ButtonBorder); border-radius: 14px; background: var(--tk-bg, Canvas); color: var(--tk-text, CanvasText); }
.tk-story-map-header { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; padding: 9px 12px; border-bottom: 1px solid var(--tk-border, ButtonBorder); font-size: 12px; }
.tk-story-map-header strong { font-size: 14px; }
.tk-story-map-header span { color: var(--tk-muted, GrayText); }
.tk-story-map-canvas { height: min(480px, 65dvh); min-height: 280px; position: relative; }
.tk-story-map .react-flow { --xy-background-color: var(--tk-bg, Canvas); --xy-attribution-background-color: var(--tk-surface, Canvas); }
.tk-story-map .react-flow__attribution a { color: var(--tk-muted, GrayText); }
.tk-story-map .react-flow__handle { opacity: 0; pointer-events: none; }
.tk-story-map-node { box-sizing: border-box; width: ${NODE_WIDTH}px; height: ${NODE_HEIGHT}px; display: flex; flex-direction: column; gap: 7px; padding: 11px 13px; border: 1px solid var(--tk-border, ButtonBorder); border-radius: 13px; text-align: left; background: var(--tk-surface, Canvas); color: var(--tk-text, CanvasText); cursor: pointer; font: inherit; }
.tk-story-map-node:hover { background: var(--tk-surface-soft, ButtonFace); }
.tk-story-map-node:focus-visible { outline: 3px solid var(--tk-focus, Highlight); outline-offset: 3px; }
.tk-story-map-node.on-route { border-color: var(--tk-accent, Highlight); }
.tk-story-map-node[aria-current] { border: 2px solid var(--tk-accent, Highlight); background: var(--tk-muted-accent, ButtonFace); }
.tk-story-map-node-meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; line-height: 1.4; color: var(--tk-muted, GrayText); }
.tk-story-map-node-meta b { font-weight: 700; color: var(--tk-text, CanvasText); }
.tk-story-map-node-input { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; font-size: 13px; line-height: 1.5; }
.tk-story-map-node-count { margin-top: auto; font-size: 11px; line-height: 1.4; color: var(--tk-muted, GrayText); }
.tk-story-map-controls { display: flex; overflow: hidden; border: 1px solid var(--tk-border, ButtonBorder); border-radius: 11px; background: var(--tk-surface, Canvas); box-shadow: 0 2px 8px #0001; }
.tk-story-map-controls button { min-width: 42px; min-height: 42px; padding: 7px 10px; border: 0; border-right: 1px solid var(--tk-border, ButtonBorder); background: transparent; color: var(--tk-text, CanvasText); font: inherit; font-size: 14px; cursor: pointer; }
.tk-story-map-controls button:last-child { border-right: 0; }
.tk-story-map-controls button:hover { background: var(--tk-surface-soft, ButtonFace); }
.tk-story-map-controls button:focus-visible { outline: 2px solid var(--tk-focus, Highlight); outline-offset: -3px; }
.tk-story-map-empty { padding: 24px 16px; font-size: 14px; color: var(--tk-muted, GrayText); }
@media (max-width: 600px) { .tk-story-map-header { padding: 8px 10px; } .tk-story-map-canvas { height: 56dvh; min-height: 280px; } .tk-story-map .react-flow__panel { margin: 8px; } .tk-story-map-controls button { min-width: 44px; min-height: 44px; } }
`;

function TurnCard({ id, data }: NodeProps<TurnNode>) {
  const preview = data.row.input.trim().slice(0, 120) || '（空白输入）';
  return <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <button
      type="button"
      className={`tk-story-map-node nodrag nopan${data.onRoute ? ' on-route' : ''}`}
      aria-label={`预览剧情：${preview}，${data.row.candidates} 条候选`}
      aria-current={data.current ? 'step' : undefined}
      onClick={() => data.row.previewCandidateId ? data.onPreview(id, data.row.previewCandidateId) : data.onPreview(id)}
    >
      <span className="tk-story-map-node-meta">
        <b>第 {data.depth + 1} 轮</b>
        {data.current ? <span>当前进展</span> : data.onRoute ? <span>当前路线</span> : null}
      </span>
      <span className="tk-story-map-node-input">{preview}</span>
      <span className="tk-story-map-node-count">{data.row.candidates} 条候选</span>
    </button>
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>;
}

const NODE_TYPES = { turn: TurnCard };

function MapCanvas({ rows, currentTurnId, onPreview }: StoryMapProps) {
  const flow = useReactFlow<TurnNode>();
  const graph = useMemo(() => {
    const byId = new Map(rows.map(row => [row.id, row]));
    const route = new Set<string>();
    let current = currentTurnId;
    while (current && byId.has(current) && !route.has(current)) {
      route.add(current);
      current = byId.get(current)?.parentTurnId;
    }

    // Resolve depths iteratively so a long conversation does not grow the JS call stack.
    const depths = new Map<string, number>();
    for (const row of rows) {
      const trail: string[] = [];
      let ancestor: TurnSummary | undefined = row;
      while (ancestor && !depths.has(ancestor.id)) {
        trail.push(ancestor.id);
        ancestor = ancestor.parentTurnId ? byId.get(ancestor.parentTurnId) : undefined;
      }
      let depth = ancestor ? depths.get(ancestor.id)! : -1;
      for (const id of trail.reverse()) depths.set(id, ++depth);
    }

    const lanes = new Map<number, number>();
    const nodes: TurnNode[] = rows.map(row => {
      const depth = depths.get(row.id)!;
      const lane = lanes.get(depth) ?? 0;
      lanes.set(depth, lane + 1);
      return {
        id: row.id,
        type: 'turn',
        position: { x: depth * (NODE_WIDTH + 72), y: lane * (NODE_HEIGHT + 32) },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        style: { pointerEvents: 'all' },
        data: { row, depth, current: row.id === currentTurnId, onRoute: route.has(row.id), onPreview },
      };
    });
    const edges: Edge[] = rows.flatMap(row => {
      const parent = row.parentTurnId ? byId.get(row.parentTurnId) : undefined;
      if (!parent) return [];
      const onRoute = route.has(parent.id) && route.has(row.id);
      return [{
        id: `turn:${row.id}`,
        source: parent.id,
        target: row.id,
        type: 'smoothstep',
        ariaLabel: `${onRoute ? '当前路线' : '剧情分支'}：${parent.input} → ${row.input}`,
        style: { stroke: onRoute ? 'var(--tk-accent, Highlight)' : 'var(--tk-border, ButtonBorder)', strokeWidth: onRoute ? 2.5 : 1.5 },
      }];
    });
    return { nodes, edges };
  }, [rows, currentTurnId, onPreview]);

  function locateCurrent() {
    const node = currentTurnId ? flow.getNode(currentTurnId) : undefined;
    if (node) void flow.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, { zoom: 1 });
  }

  return <ReactFlow<TurnNode>
    nodes={graph.nodes}
    edges={graph.edges}
    nodeTypes={NODE_TYPES}
    nodesDraggable={false}
    nodesConnectable={false}
    nodesFocusable={false}
    edgesFocusable={false}
    edgesReconnectable={false}
    elementsSelectable={false}
    deleteKeyCode={null}
    selectionKeyCode={null}
    onlyRenderVisibleElements
    minZoom={0.0001}
    maxZoom={2}
    fitView
    fitViewOptions={FIT_OPTIONS}
    aria-label="已保存的剧情路线"
  >
    <Panel position="top-right">
      <div className="tk-story-map-controls" role="group" aria-label="地图缩放">
        <button type="button" aria-label="放大地图" title="放大" onClick={() => { void flow.zoomIn(); }}>＋</button>
        <button type="button" aria-label="缩小地图" title="缩小" onClick={() => { void flow.zoomOut(); }}>−</button>
        <button type="button" aria-label="显示全部剧情" onClick={() => { void flow.fitView(FIT_OPTIONS); }}>全图</button>
        {currentTurnId ? <button type="button" onClick={locateCurrent}>回到当前</button> : null}
      </div>
    </Panel>
  </ReactFlow>;
}

/** Existing turns only: preview is the sole outward action; the parent owns explicit continuation. */
export function StoryMap(props: StoryMapProps) {
  return <section className="tk-story-map" aria-label="剧情地图">
    <style>{flowStyles}{MAP_STYLES}</style>
    <header className="tk-story-map-header">
      <strong>剧情地图</strong><span>{props.rows.length} 轮 · 点开节点看一看</span>
    </header>
    {props.rows.length > 0 ? <div className="tk-story-map-canvas">
      <ReactFlowProvider><MapCanvas {...props} /></ReactFlowProvider>
    </div> : <div className="tk-story-map-empty">还没有剧情，聊过几轮再来看看。</div>}
  </section>;
}
