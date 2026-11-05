import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  MemoryNeuron,
  NeuralKnowledgeBase,
  NeuronCategory,
  NeuronRelationType
} from '../types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Search,
  Edit3,
  Link2,
  Trash2,
  Sparkles,
  Check,
  X,
  Download,
  FileJson,
  FileText,
  Filter,
  Eye,
  Layers
} from 'lucide-react';
import {
  downloadExtractedBrainFile
} from '../utils/neuralMemory';

export interface NeuralBrainGraphProps {
  neurons?: MemoryNeuron[];
  knowledgeBase?: NeuralKnowledgeBase;
  compact?: boolean;
  selectedNeuronId?: string | null;
  onSelectNeuron?: (neuron: MemoryNeuron) => void;
  onUpdateNeuron?: (
    neuronId: string,
    updates: Partial<
      Pick<
        MemoryNeuron,
        'title' | 'distilledInsight' | 'chunkText' | 'category' | 'keyPhrases'
      >
    >
  ) => void;
  onConnectNeurons?: (
    sourceId: string,
    targetId: string,
    relation: NeuronRelationType
  ) => void;
  onRemoveConnection?: (sourceId: string, targetId: string) => void;
  onDeleteNeuron?: (neuronId: string) => void;
  onAskAboutNeuron?: (neuron: MemoryNeuron) => void;
  height?: number;
  interactive?: boolean;
}

const RELATION_LABELS: Record<NeuronRelationType, { label: string; color: string }> = {
  supports: { label: 'supports', color: '#34d399' },
  extends: { label: 'extends', color: '#38bdf8' },
  contradicts: { label: 'contradicts', color: '#f43f5e' },
  related_to: { label: 'related to', color: '#94a3b8' },
  part_of: { label: 'part of', color: '#818cf8' },
  evidence_for: { label: 'evidence for', color: '#2dd4bf' }
};

const CATEGORY_META: Record<
  NeuronCategory,
  {
    label: string;
    fill: string;
    stroke: string;
    glow: string;
    quadrantAngle: number;
  }
> = {
  manual_deep_read: {
    label: 'Deep-Read',
    fill: '#0284c7',
    stroke: '#7dd3fc',
    glow: 'rgba(56, 189, 248, 0.35)',
    quadrantAngle: -Math.PI * 0.72 // Top-Left cluster
  },
  entity_context: {
    label: 'Entities',
    fill: '#059669',
    stroke: '#6ee7b7',
    glow: 'rgba(52, 211, 153, 0.35)',
    quadrantAngle: -Math.PI * 0.25 // Top-Right cluster
  },
  qwen_synthesis: {
    label: 'Synthesis',
    fill: '#d97706',
    stroke: '#fcd34d',
    glow: 'rgba(245, 158, 11, 0.35)',
    quadrantAngle: Math.PI * 0.25 // Bottom-Right cluster
  },
  core_architecture: {
    label: 'Core Hub',
    fill: '#7c3aed',
    stroke: '#d8b4fe',
    glow: 'rgba(192, 132, 252, 0.35)',
    quadrantAngle: Math.PI * 0.72 // Bottom-Left cluster
  }
};

interface ComputedNode {
  neuron: MemoryNeuron;
  x: number;
  y: number;
  radius: number;
  fillColor: string;
  strokeColor: string;
  glowColor: string;
  shortLabel: string;
  degree: number;
}

interface ComputedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  relation: NeuronRelationType;
  isExplicit: boolean;
  sharedTerm?: string;
}

export const NeuralBrainGraph: React.FC<NeuralBrainGraphProps> = ({
  neurons: propNeurons,
  knowledgeBase,
  compact = false,
  selectedNeuronId,
  onSelectNeuron,
  onUpdateNeuron,
  onConnectNeurons,
  onRemoveConnection,
  onDeleteNeuron,
  onAskAboutNeuron,
  height: propHeight,
  interactive = true
}) => {
  const neurons = useMemo(
    () => propNeurons || knowledgeBase?.neurons || [],
    [propNeurons, knowledgeBase?.neurons]
  );
  const height = propHeight || (compact ? 255 : 390);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<NeuronCategory | 'all'>('all');
  const [edgeDisplayMode, setEdgeDisplayMode] = useState<'focused' | 'all'>('focused');
  const [layoutMode, setLayoutMode] = useState<'clustered' | 'radial'>('clustered');

  // Pan, Zoom & Node Dragging State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0
  });

  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragNodeStartRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origDx: number;
    origDy: number;
    moved: boolean;
  } | null>(null);

  // Inline Node Editor & Relationship Creator State
  const [isEditingNode, setIsEditingNode] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editInsight, setEditInsight] = useState<string>('');
  const [editCategory, setEditCategory] = useState<NeuronCategory>('manual_deep_read');
  const [editPhrases, setEditPhrases] = useState<string>('');

  const [connectTargetId, setConnectTargetId] = useState<string>('');
  const [connectRelation, setConnectRelation] = useState<NeuronRelationType>('supports');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 680,
    height
  });

  // Track container width responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateDimensions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120) {
        setCanvasSize({
          width: Math.floor(rect.width),
          height
        });
      }
    };
    updateDimensions();
    const ro = new ResizeObserver(updateDimensions);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const filteredNeurons = useMemo(() => {
    return neurons.filter((n) => {
      if (categoryFilter !== 'all' && n.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchInsight = (n.distilledInsight || '').toLowerCase().includes(q);
        const matchPhrase = (n.keyPhrases || []).some((p) => p.toLowerCase().includes(q));
        return matchTitle || matchInsight || matchPhrase;
      }
      return true;
    });
  }, [neurons, categoryFilter, searchQuery]);

  // Compute Intelligent Clustered / Radial Node Positions with Multi-Pass Collision Relaxation
  const { nodes, edges, centerX, centerY } = useMemo(() => {
    const W = Math.max(420, canvasSize.width);
    const H = Math.max(280, canvasSize.height);
    const cx = W / 2;
    const cy = H / 2;
    const displayNeurons = filteredNeurons.slice(0, 64);
    const total = displayNeurons.length;

    // Pre-calculate node degree (number of connections)
    const degreeMap = new Map<string, number>();
    displayNeurons.forEach((n) => {
      const deg = (n.synapseEdges?.length || 0) + (n.synapses?.length || 0);
      degreeMap.set(n.id, deg);
    });

    // Group by category for clustered layout
    const byCategory: Record<NeuronCategory, MemoryNeuron[]> = {
      manual_deep_read: [],
      entity_context: [],
      qwen_synthesis: [],
      core_architecture: []
    };
    displayNeurons.forEach((n) => {
      const cat: NeuronCategory =
        n.category && byCategory[n.category] ? n.category : 'manual_deep_read';
      byCategory[cat].push(n);
    });

    const basePositions: {
      neuron: MemoryNeuron;
      x: number;
      y: number;
      radius: number;
      catMeta: (typeof CATEGORY_META)[NeuronCategory];
      degree: number;
    }[] = [];

    const minDim = Math.min(W, H);

    if (layoutMode === 'clustered') {
      (Object.keys(byCategory) as NeuronCategory[]).forEach((cat) => {
        const group = byCategory[cat];
        if (group.length === 0) return;
        const meta = CATEGORY_META[cat];
        const clusterDist = Math.max(92, minDim * 0.29);
        const clusterCx = cx + Math.cos(meta.quadrantAngle) * clusterDist * 1.18;
        const clusterCy = cy + Math.sin(meta.quadrantAngle) * clusterDist * 0.86;

        group.forEach((neuron, idx) => {
          const deg = degreeMap.get(neuron.id) || 0;
          const ringIdx = Math.floor(idx / 6);
          const posInRing = idx % 6;
          const countInRing = Math.min(6, group.length - ringIdx * 6);
          const localRadius = group.length === 1 ? 0 : 38 + ringIdx * 44;
          const localAngle =
            meta.quadrantAngle +
            (posInRing / Math.max(1, countInRing)) * Math.PI * 2 +
            ringIdx * 0.45;

          const rawX = clusterCx + Math.cos(localAngle) * localRadius;
          const rawY = clusterCy + Math.sin(localAngle) * localRadius;
          const radius = Math.min(18, Math.max(10, 9.5 + neuron.strength * 2.2 + Math.min(4, deg * 0.5)));

          basePositions.push({
            neuron,
            x: rawX,
            y: rawY,
            radius,
            catMeta: meta,
            degree: deg
          });
        });
      });
    } else {
      // Concentric Radial Rings
      displayNeurons.forEach((neuron, idx) => {
        const cat: NeuronCategory = neuron.category || 'manual_deep_read';
        const meta = CATEGORY_META[cat] || CATEGORY_META.manual_deep_read;
        const deg = degreeMap.get(neuron.id) || 0;
        const isInner = idx < 7;
        const ringCount = isInner ? Math.min(total, 7) : Math.max(1, total - 7);
        const ringIdx = isInner ? idx : idx - 7;
        const orbitR = isInner ? minDim * 0.24 : minDim * 0.39;
        const angle = (ringIdx / ringCount) * Math.PI * 2 - Math.PI / 2 + (isInner ? 0 : 0.28);

        const rawX = cx + Math.cos(angle) * orbitR * 1.15;
        const rawY = cy + Math.sin(angle) * orbitR * 0.88;
        const radius = Math.min(18, Math.max(10, 9.5 + neuron.strength * 2.2 + Math.min(4, deg * 0.5)));

        basePositions.push({
          neuron,
          x: rawX,
          y: rawY,
          radius,
          catMeta: meta,
          degree: deg
        });
      });
    }

    // Deterministic Force-Relaxation Pass to eliminate node & label overlap
    const minSeparationX = 96; // Horizontal clearance for labels
    const minSeparationY = 46; // Vertical clearance for labels
    for (let iter = 0; iter < 28; iter++) {
      for (let i = 0; i < basePositions.length; i++) {
        for (let j = i + 1; j < basePositions.length; j++) {
          const a = basePositions[i];
          const b = basePositions[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          if (absDx < minSeparationX && absDy < minSeparationY) {
            const overlapX = (minSeparationX - absDx) * 0.22;
            const overlapY = (minSeparationY - absDy) * 0.28;
            const signX = dx >= 0 ? 1 : -1;
            const signY = dy >= 0 ? 1 : -1;
            a.x -= signX * overlapX;
            b.x += signX * overlapX;
            a.y -= signY * overlapY;
            b.y += signY * overlapY;
          }
        }
        // Keep away from central hub (cx, cy)
        const p = basePositions[i];
        const hubDx = p.x - cx;
        const hubDy = p.y - cy;
        const hubDist = Math.hypot(hubDx, hubDy);
        if (hubDist < 58) {
          const push = (58 - hubDist) * 0.4;
          const angle = Math.atan2(hubDy || 1, hubDx || 1);
          p.x += Math.cos(angle) * push;
          p.y += Math.sin(angle) * push;
        }
        // Soft viewport padding
        p.x = Math.max(58, Math.min(W - 58, p.x));
        p.y = Math.max(38, Math.min(H - 42, p.y));
      }
    }

    const computedNodes: ComputedNode[] = basePositions.map((p) => {
      const customOffset = nodeOffsets[p.neuron.id] || { dx: 0, dy: 0 };
      const rawTitle = p.neuron.title.replace(/^Chunk #\d+:\s*/i, '').trim();
      const shortLabel = rawTitle.length > 22 ? `${rawTitle.slice(0, 20)}…` : rawTitle;
      return {
        neuron: p.neuron,
        x: p.x + customOffset.dx,
        y: p.y + customOffset.dy,
        radius: p.radius,
        fillColor: p.catMeta.fill,
        strokeColor: p.catMeta.stroke,
        glowColor: p.catMeta.glow,
        shortLabel,
        degree: p.degree
      };
    });

    const nodeMap = new Map<string, ComputedNode>();
    computedNodes.forEach((n) => nodeMap.set(n.neuron.id, n));

    const computedEdges: ComputedEdge[] = [];
    const seenPairs = new Set<string>();

    // 1. Explicit SynapseEdges & Synapses
    computedNodes.forEach((source) => {
      const explicitEdges = source.neuron.synapseEdges || [];
      explicitEdges.forEach((edge) => {
        const target = nodeMap.get(edge.targetId);
        if (!target) return;
        const pairKey = [source.neuron.id, target.neuron.id].sort().join('--');
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        computedEdges.push({
          id: pairKey,
          sourceId: source.neuron.id,
          targetId: target.neuron.id,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          relation: edge.relation || 'related_to',
          isExplicit: true
        });
      });

      (source.neuron.synapses || []).forEach((targetId) => {
        const target = nodeMap.get(targetId);
        if (!target) return;
        const pairKey = [source.neuron.id, target.neuron.id].sort().join('--');
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        computedEdges.push({
          id: pairKey,
          sourceId: source.neuron.id,
          targetId: target.neuron.id,
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          relation: 'related_to',
          isExplicit: true
        });
      });
    });

    // 2. Semantic shared-phrase links (capped to top 2 strongest links per node to prevent hairball)
    for (let i = 0; i < computedNodes.length; i++) {
      let inferredForNode = 0;
      for (let j = i + 1; j < computedNodes.length; j++) {
        if (inferredForNode >= 2) break;
        const a = computedNodes[i];
        const b = computedNodes[j];
        const pairKey = [a.neuron.id, b.neuron.id].sort().join('--');
        if (seenPairs.has(pairKey)) continue;

        const aPhrases = (a.neuron.keyPhrases || []).map((p) => p.toLowerCase());
        const bPhrases = (b.neuron.keyPhrases || []).map((p) => p.toLowerCase());
        const shared = aPhrases.find((p) => p.length > 3 && bPhrases.includes(p));

        if (shared) {
          seenPairs.add(pairKey);
          inferredForNode++;
          computedEdges.push({
            id: pairKey,
            sourceId: a.neuron.id,
            targetId: b.neuron.id,
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            relation: 'related_to',
            isExplicit: false,
            sharedTerm: shared
          });
        }
      }
    }

    return {
      nodes: computedNodes,
      edges: computedEdges,
      centerX: cx,
      centerY: cy
    };
  }, [filteredNeurons, nodeOffsets, canvasSize.width, canvasSize.height, layoutMode]);

  const activeNeuron = useMemo(() => {
    const id = selectedNeuronId || hoveredId;
    if (!id) return neurons[0] || null;
    return neurons.find((n) => n.id === id) || neurons[0] || null;
  }, [neurons, selectedNeuronId, hoveredId]);

  const activeFocusId = hoveredId || selectedNeuronId || activeNeuron?.id || null;

  // Convert client mouse coordinates to world graph coordinates (accounting for pan & zoom)
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { wx: 0, wy: 0 };
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = (sx - centerX - pan.x) / zoom + centerX;
      const wy = (sy - centerY - pan.y) / zoom + centerY;
      return { wx, wy };
    },
    [centerX, centerY, pan.x, pan.y, zoom]
  );

  // Hit-test nodes in world coordinates
  const findNodeAtWorldPos = useCallback(
    (wx: number, wy: number): ComputedNode | null => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dist = Math.hypot(wx - node.x, wy - node.y);
        if (dist <= node.radius + 7) {
          return node;
        }
      }
      return null;
    },
    [nodes]
  );

  // High-DPI HTML5 Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isLowCpu =
      typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4;
    const dpr =
      typeof window !== 'undefined'
        ? Math.min(isLowCpu ? 1.25 : 2, window.devicePixelRatio || 1)
        : 1;
    const W = canvasSize.width;
    const H = canvasSize.height;

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Deep Obsidian Canvas Background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, W, H);

    // Subtle dot grid
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    const gridStep = 28;
    for (let gx = (pan.x % gridStep + gridStep) % gridStep; gx < W; gx += gridStep) {
      for (let gy = (pan.y % gridStep + gridStep) % gridStep; gy < H; gy += gridStep) {
        ctx.fillRect(gx, gy, 1.2, 1.2);
      }
    }

    // Apply Camera Pan & Zoom around (centerX, centerY)
    ctx.translate(centerX + pan.x, centerY + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-centerX, -centerY);

    // 2. Draw Category Cluster Halos (when in clustered mode)
    if (layoutMode === 'clustered') {
      const minDim = Math.min(W, H);
      const clusterDist = Math.max(92, minDim * 0.29);
      (Object.keys(CATEGORY_META) as NeuronCategory[]).forEach((cat) => {
        const hasNodes = nodes.some((n) => n.neuron.category === cat);
        if (!hasNodes) return;
        const meta = CATEGORY_META[cat];
        const qx = centerX + Math.cos(meta.quadrantAngle) * clusterDist * 1.18;
        const qy = centerY + Math.sin(meta.quadrantAngle) * clusterDist * 0.86;

        const grad = ctx.createRadialGradient(qx, qy, 8, qx, qy, 92);
        grad.addColorStop(0, meta.glow.replace('0.35', '0.11'));
        grad.addColorStop(1, 'rgba(6, 10, 18, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(qx, qy, 92, 0, Math.PI * 2);
        ctx.fill();

        // Subtle cluster watermarks
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.38)';
        ctx.textAlign = 'center';
        ctx.fillText(meta.label.toUpperCase(), qx, qy - 68);
      });
    } else {
      // Concentric Radar Rings
      const minDim = Math.min(W, H);
      [0.24, 0.39].forEach((rRatio) => {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          minDim * rRatio * 1.15,
          minDim * rRatio * 0.88,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // 3. Draw Hub Spokes (subtle backbone from SPIDAR Core to each node)
    nodes.forEach((node) => {
      const isFocused = node.neuron.id === activeFocusId;
      if (edgeDisplayMode === 'focused' && !isFocused) {
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.22)';
        ctx.lineWidth = 0.75;
      } else {
        ctx.strokeStyle = isFocused ? 'rgba(56, 189, 248, 0.5)' : 'rgba(51, 65, 85, 0.35)';
        ctx.lineWidth = isFocused ? 1.3 : 0.9;
      }
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(node.x, node.y);
      ctx.stroke();
    });

    // 4. Draw Selective / All Synapse Edges
    const connectedNodeIds = new Set<string>();
    if (activeFocusId) {
      connectedNodeIds.add(activeFocusId);
      edges.forEach((e) => {
        if (e.sourceId === activeFocusId) connectedNodeIds.add(e.targetId);
        if (e.targetId === activeFocusId) connectedNodeIds.add(e.sourceId);
      });
    }

    edges.forEach((edge) => {
      const isIncidentToFocus =
        edge.sourceId === activeFocusId || edge.targetId === activeFocusId;

      // In 'focused' mode, hide secondary inferred edges that aren't connected to the focused node
      if (edgeDisplayMode === 'focused' && !isIncidentToFocus && !edge.isExplicit) {
        return;
      }

      const relMeta = RELATION_LABELS[edge.relation] || RELATION_LABELS.related_to;
      ctx.save();
      if (isIncidentToFocus) {
        ctx.strokeStyle = relMeta.color;
        ctx.lineWidth = 2.1;
        ctx.globalAlpha = 0.92;
      } else {
        ctx.strokeStyle = edge.isExplicit ? relMeta.color : '#475569';
        ctx.lineWidth = edge.isExplicit ? 1.1 : 0.85;
        ctx.globalAlpha = edgeDisplayMode === 'all' ? 0.42 : 0.2;
        if (!edge.isExplicit) {
          ctx.setLineDash([3, 3]);
        }
      }

      // Slight curve for readability
      const midX = (edge.x1 + edge.x2) / 2;
      const midY = (edge.y1 + edge.y2) / 2 - 10;
      ctx.beginPath();
      ctx.moveTo(edge.x1, edge.y1);
      ctx.quadraticCurveTo(midX, midY, edge.x2, edge.y2);
      ctx.stroke();

      // Show relationship pill badge ONLY on edges incident to the focused node
      if (isIncidentToFocus) {
        const badgeText = edge.isExplicit
          ? relMeta.label
          : edge.sharedTerm
          ? `#${edge.sharedTerm}`
          : 'linked';
        ctx.font = '500 8.5px ui-monospace, SFMono-Regular, Menlo, monospace';
        const textWidth = ctx.measureText(badgeText).width;
        const pillW = textWidth + 10;
        const pillH = 14;
        const bx = (edge.x1 + 2 * midX + edge.x2) / 4;
        const by = (edge.y1 + 2 * midY + edge.y2) / 4;

        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(9, 13, 21, 0.92)';
        ctx.strokeStyle = relMeta.color;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.roundRect(bx - pillW / 2, by - pillH / 2, pillW, pillH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx, by + 0.5);
      }
      ctx.restore();
    });

    // 5. Draw Central SPIDAR Core Hub
    const hubGrad = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, 34);
    hubGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    hubGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#bae6fd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CORE', centerX, centerY);

    // 6. Draw Nodes & Collision-Free Labels (priority sorted so focused/neighbor labels never get occluded)
    const placedBoxes: { x1: number; y1: number; x2: number; y2: number }[] = nodes.map((n) => ({
      x1: n.x - n.radius - 2,
      y1: n.y - n.radius - 2,
      x2: n.x + n.radius + 2,
      y2: n.y + n.radius + 2
    }));

    const boxOverlaps = (b: { x1: number; y1: number; x2: number; y2: number }) =>
      placedBoxes.some(
        (p) => !(b.x2 < p.x1 || b.x1 > p.x2 || b.y2 < p.y1 || b.y1 > p.y2)
      );

    // Draw node circles first
    nodes.forEach((node) => {
      const isSelected = node.neuron.id === selectedNeuronId;
      const isHovered = node.neuron.id === hoveredId;
      const isNeighbor = connectedNodeIds.has(node.neuron.id);
      const isDimmed =
        edgeDisplayMode === 'focused' &&
        Boolean(activeFocusId) &&
        !isNeighbor &&
        !isSelected &&
        !isHovered;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.38 : 1;

      if (isSelected || isHovered) {
        const glowR = node.radius + 11;
        const g = ctx.createRadialGradient(node.x, node.y, node.radius * 0.4, node.x, node.y, glowR);
        g.addColorStop(0, node.glowColor);
        g.addColorStop(1, 'rgba(6, 10, 18, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = node.fillColor;
      ctx.strokeStyle = isSelected || isHovered ? '#ffffff' : node.strokeColor;
      ctx.lineWidth = isSelected || isHovered ? 2.4 : 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${node.neuron.strength.toFixed(1)}`, node.x, node.y + 0.5);
      ctx.restore();
    });

    // Draw non-overlapping labels (prioritizing selected/hovered/neighbor nodes)
    const labelOrder = [...nodes].sort((a, b) => {
      const score = (n: ComputedNode) =>
        n.neuron.id === hoveredId
          ? 4
          : n.neuron.id === selectedNeuronId
          ? 3
          : connectedNodeIds.has(n.neuron.id)
          ? 2
          : 1;
      return score(b) - score(a);
    });

    labelOrder.forEach((node) => {
      const isSelected = node.neuron.id === selectedNeuronId;
      const isHovered = node.neuron.id === hoveredId;
      const isNeighbor = connectedNodeIds.has(node.neuron.id);
      const isPriority = isSelected || isHovered || isNeighbor;
      const isDimmed =
        edgeDisplayMode === 'focused' &&
        Boolean(activeFocusId) &&
        !isPriority;

      if (!isPriority && zoom < 0.68) return;

      const labelText = node.shortLabel;
      ctx.font =
        isSelected || isHovered
          ? '600 10px ui-sans-serif, system-ui, sans-serif'
          : '500 9.5px ui-sans-serif, system-ui, sans-serif';
      const labelW = ctx.measureText(labelText).width + 10;
      const labelH = 16;

      const candidateSlots = [
        { lx: node.x, ly: node.y + node.radius + 11 },
        { lx: node.x, ly: node.y - node.radius - 11 }
      ];

      let chosenSlot: { lx: number; ly: number } | null = null;
      for (const slot of candidateSlots) {
        const box = {
          x1: slot.lx - labelW / 2 - 2,
          y1: slot.ly - labelH / 2 - 1,
          x2: slot.lx + labelW / 2 + 2,
          y2: slot.ly + labelH / 2 + 1
        };
        if (!boxOverlaps(box)) {
          chosenSlot = slot;
          placedBoxes.push(box);
          break;
        }
      }

      if (!chosenSlot && (isSelected || isHovered)) {
        chosenSlot = candidateSlots[0];
      }
      if (!chosenSlot) return;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.38 : 1;
      ctx.fillStyle =
        isSelected || isHovered ? 'rgba(15, 23, 42, 0.96)' : 'rgba(9, 13, 21, 0.86)';
      ctx.strokeStyle =
        isSelected || isHovered ? node.strokeColor : 'rgba(51, 65, 85, 0.65)';
      ctx.lineWidth = isSelected || isHovered ? 1.1 : 0.75;
      ctx.beginPath();
      ctx.roundRect(
        chosenSlot.lx - labelW / 2,
        chosenSlot.ly - labelH / 2,
        labelW,
        labelH,
        4
      );
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, chosenSlot.lx, chosenSlot.ly + 0.5);
      ctx.restore();
    });

    ctx.restore();
  }, [
    canvasSize.width,
    canvasSize.height,
    nodes,
    edges,
    centerX,
    centerY,
    pan.x,
    pan.y,
    zoom,
    layoutMode,
    edgeDisplayMode,
    activeFocusId,
    selectedNeuronId,
    hoveredId
  ]);

  const startEditingActiveNeuron = () => {
    if (!activeNeuron) return;
    setEditTitle(activeNeuron.title);
    setEditInsight(activeNeuron.distilledInsight || activeNeuron.chunkText);
    setEditCategory(activeNeuron.category || 'manual_deep_read');
    setEditPhrases((activeNeuron.keyPhrases || []).join(', '));
    setIsEditingNode(true);
  };

  const saveEditedNeuron = () => {
    if (!activeNeuron || !onUpdateNeuron) return;
    const parsedPhrases = editPhrases
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdateNeuron(activeNeuron.id, {
      title: editTitle.trim() || activeNeuron.title,
      distilledInsight: editInsight.trim() || activeNeuron.distilledInsight,
      category: editCategory,
      keyPhrases: parsedPhrases.length > 0 ? parsedPhrases : activeNeuron.keyPhrases
    });
    setIsEditingNode(false);
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    setZoom((z) => Math.max(0.45, Math.min(2.6, Number((z + delta).toFixed(2)))));
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    const hitNode = findNodeAtWorldPos(wx, wy);

    if (hitNode) {
      const currentOff = nodeOffsets[hitNode.neuron.id] || { dx: 0, dy: 0 };
      setDraggingNodeId(hitNode.neuron.id);
      dragNodeStartRef.current = {
        id: hitNode.neuron.id,
        startX: e.clientX,
        startY: e.clientY,
        origDx: currentOff.dx,
        origDy: currentOff.dy,
        moved: false
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingNodeId && dragNodeStartRef.current) {
      const dxScreen = e.clientX - dragNodeStartRef.current.startX;
      const dyScreen = e.clientY - dragNodeStartRef.current.startY;
      if (Math.hypot(dxScreen, dyScreen) > 3) {
        dragNodeStartRef.current.moved = true;
      }
      const dx = dxScreen / zoom;
      const dy = dyScreen / zoom;
      const id = dragNodeStartRef.current.id;
      setNodeOffsets((prev) => ({
        ...prev,
        [id]: {
          dx: dragNodeStartRef.current!.origDx + dx,
          dy: dragNodeStartRef.current!.origDy + dy
        }
      }));
      return;
    }

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy
      });
      return;
    }

    const { wx, wy } = screenToWorld(e.clientX, e.clientY);
    const hitNode = findNodeAtWorldPos(wx, wy);
    setHoveredId(hitNode ? hitNode.neuron.id : null);
  };

  const handleCanvasPointerUp = () => {
    if (draggingNodeId && dragNodeStartRef.current) {
      const wasClick = !dragNodeStartRef.current.moved;
      const clickedId = dragNodeStartRef.current.id;
      setDraggingNodeId(null);
      dragNodeStartRef.current = null;
      if (wasClick) {
        const target = neurons.find((n) => n.id === clickedId);
        if (target) {
          setIsEditingNode(false);
          onSelectNeuron?.(target);
        }
      }
      return;
    }
    setIsPanning(false);
  };

  const handleDownloadExport = (format: 'json' | 'md' | 'txt') => {
    if (!knowledgeBase) return;
    downloadExtractedBrainFile(
      knowledgeBase,
      format === 'json' ? 'json' : format === 'md' ? 'markdown' : 'prompt'
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col space-y-2.5">
      {/* Top Interactive Controls Bar: Search, Category Filter, Edge Disclosure & Zoom */}
      {interactive && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/90 border border-slate-800/90 rounded-xl px-2.5 py-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes, insights, or tags..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-8 pr-6 py-1 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Filter className="w-3 h-3 text-slate-500 mr-0.5" />
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'manual_deep_read', label: 'Deep-Read' },
                { id: 'entity_context', label: 'Entities' },
                { id: 'qwen_synthesis', label: 'Synthesis' },
                { id: 'core_architecture', label: 'Core' }
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50 font-semibold'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              type="button"
              onClick={() =>
                setEdgeDisplayMode((m) => (m === 'focused' ? 'all' : 'focused'))
              }
              title={
                edgeDisplayMode === 'focused'
                  ? 'Showing focused connections (click to show all edges)'
                  : 'Showing all connections (click for clean focused view)'
              }
              className={`px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                edgeDisplayMode === 'focused'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>{edgeDisplayMode === 'focused' ? 'Focused Links' : 'All Links'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setLayoutMode((l) => (l === 'clustered' ? 'radial' : 'clustered'))
              }
              title="Toggle Clustered Quadrant vs. Concentric Ring Layout"
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3 h-3 text-sky-400" />
              <span>{layoutMode === 'clustered' ? 'Clusters' : 'Rings'}</span>
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
              title="Zoom Out"
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.2).toFixed(2))))}
              title="Zoom In"
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                setNodeOffsets({});
              }}
              title="Reset Pan, Zoom & Node Positions"
              className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* High-DPI Interactive HTML5 Canvas Knowledge Graph */}
      <div
        style={{ height: `${height}px` }}
        className="relative w-full rounded-xl bg-[#060a12] border border-slate-800/90 overflow-hidden select-none shadow-inner"
      >
        {/* Top-Left Legend */}
        <div className="absolute top-2.5 left-3 z-10 flex flex-wrap items-center gap-2.5 pointer-events-none bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80">
          <span className="flex items-center gap-1 text-[10px] font-mono text-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
            Deep-Read
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Entities
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            Synthesis
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            Core Hub
          </span>
        </div>

        {/* Top-Right Status Badge */}
        <div className="absolute top-2.5 right-3 z-10 text-[10px] font-mono text-slate-400 bg-slate-950/85 px-2.5 py-1 rounded-lg border border-slate-800 pointer-events-none">
          {nodes.length} Nodes · {edges.length} Synapses
        </div>

        {/* Bottom-Left Hint */}
        <div className="absolute bottom-2 left-3 z-10 text-[9.5px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/70 pointer-events-none">
          Drag nodes to rearrange · Scroll to zoom · Click node to inspect/edit
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`
          }}
          onWheel={handleCanvasWheel}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          className={`block w-full h-full ${
            draggingNodeId
              ? 'cursor-grabbing'
              : hoveredId
              ? 'cursor-pointer'
              : isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
        />
      </div>

      {/* Portable Export Bar (when knowledgeBase is provided) */}
      {knowledgeBase && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export Portable Neural Graph:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleDownloadExport('json')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-[10px] font-mono cursor-pointer transition-colors"
            >
              <FileJson className="w-3 h-3" />
              <span>.spidar-brain.json</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadExport('md')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-[10px] font-mono cursor-pointer transition-colors"
            >
              <FileText className="w-3 h-3" />
              <span>Markdown (.md)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadExport('txt')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono cursor-pointer transition-colors"
            >
              <FileText className="w-3 h-3" />
              <span>Plain Text (.txt)</span>
            </button>
          </div>
        </div>
      )}

      {/* Selected Neuron Inspector, Inline Editor & Relationship Builder */}
      {activeNeuron && (
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          {!isEditingNode ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 block">
                    {activeNeuron.category === 'manual_deep_read'
                      ? 'Manual Deep-Read Node'
                      : activeNeuron.category === 'entity_context'
                      ? 'Learned Entity & Context Node'
                      : activeNeuron.category === 'qwen_synthesis'
                      ? 'AI Synthesis Node'
                      : 'Core Cognitive Architecture'}
                  </span>
                  <h4 className="text-xs font-semibold text-white mt-0.5">
                    {activeNeuron.title}
                  </h4>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                    Tab: {activeNeuron.sourceTab}
                  </span>
                  {onUpdateNeuron && (
                    <button
                      type="button"
                      onClick={startEditingActiveNeuron}
                      title="Edit Node Title, Summary & Tags"
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-sky-300 border border-slate-800 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onAskAboutNeuron && (
                    <button
                      type="button"
                      onClick={() => onAskAboutNeuron(activeNeuron)}
                      title="Ask AI about this Neuron"
                      className="px-2 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Ask AI</span>
                    </button>
                  )}
                  {onDeleteNeuron && !activeNeuron.id.startsWith('neuron-seed-') && (
                    <button
                      type="button"
                      onClick={() => onDeleteNeuron(activeNeuron.id)}
                      title="Delete Node"
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                {activeNeuron.distilledInsight}
              </p>

              {/* Stored Raw Passage Preview */}
              {activeNeuron.chunkText &&
                activeNeuron.chunkText !== activeNeuron.distilledInsight && (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 leading-relaxed max-h-24 overflow-y-auto">
                    <span className="text-[9.5px] font-mono uppercase text-slate-500 block mb-0.5">
                      Stored Source Passage:
                    </span>
                    “{activeNeuron.chunkText}”
                  </div>
                )}

              {/* Key Phrases */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {(activeNeuron.keyPhrases || []).map((kp, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-[10px] font-mono text-sky-300"
                  >
                    #{kp}
                  </span>
                ))}
              </div>

              {/* Typed Relationship Edges Editor */}
              {onConnectNeurons && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-sky-400" />
                      <span>Relationships &amp; Synapses</span>
                    </span>
                  </div>

                  {/* Existing Explicit Relationships */}
                  {(activeNeuron.synapseEdges || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(activeNeuron.synapseEdges || []).map((edge, idx) => {
                        const targetNode = neurons.find((n) => n.id === edge.targetId);
                        if (!targetNode) return null;
                        const relInfo =
                          RELATION_LABELS[edge.relation] || RELATION_LABELS.related_to;
                        return (
                          <span
                            key={`${edge.targetId}-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300"
                          >
                            <span style={{ color: relInfo.color }}>{relInfo.label}</span>
                            <span className="text-white font-semibold">
                              → {targetNode.title.slice(0, 22)}
                            </span>
                            {onRemoveConnection && (
                              <button
                                type="button"
                                onClick={() =>
                                  onRemoveConnection(activeNeuron.id, edge.targetId)
                                }
                                className="text-slate-500 hover:text-rose-400 ml-0.5 cursor-pointer"
                                title="Remove relationship"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Add New Typed Relationship */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={connectRelation}
                      onChange={(e) =>
                        setConnectRelation(e.target.value as NeuronRelationType)
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-sky-300 focus:outline-none focus:border-sky-400"
                    >
                      <option value="supports">supports →</option>
                      <option value="extends">extends →</option>
                      <option value="evidence_for">evidence for →</option>
                      <option value="contradicts">contradicts →</option>
                      <option value="part_of">part of →</option>
                      <option value="related_to">related to →</option>
                    </select>

                    <select
                      value={connectTargetId}
                      onChange={(e) => setConnectTargetId(e.target.value)}
                      className="flex-1 min-w-[140px] bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-sky-400"
                    >
                      <option value="">Select target node to connect...</option>
                      {neurons
                        .filter((n) => n.id !== activeNeuron.id)
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.title}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      disabled={!connectTargetId}
                      onClick={() => {
                        if (!connectTargetId) return;
                        onConnectNeurons(activeNeuron.id, connectTargetId, connectRelation);
                        setConnectTargetId('');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-semibold text-[11px] cursor-pointer transition-colors"
                    >
                      Link Nodes
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Inline Node Editor Form */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                  Editing Neural Graph Node
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={saveEditedNeuron}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[11px] cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save Node</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingNode(false)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                    Node Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as NeuronCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                  >
                    <option value="manual_deep_read">Manual Deep-Read</option>
                    <option value="entity_context">Entity &amp; Context</option>
                    <option value="qwen_synthesis">AI Synthesis</option>
                    <option value="core_architecture">Core Architecture</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                  Distilled Insight / Summary
                </label>
                <textarea
                  rows={2}
                  value={editInsight}
                  onChange={(e) => setEditInsight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                  Key Phrases (comma-separated)
                </label>
                <input
                  type="text"
                  value={editPhrases}
                  onChange={(e) => setEditPhrases(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-sky-300 focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
