import React, { useMemo } from 'react';
import { ALGORITHMS } from '../services/algorithms';

interface AlgorithmMatrixProps {
  algorithmId: number; // 1-32
}

interface NodePosition {
  x: number;
  y: number;
}

interface Edge {
  from: number;
  to: number;
  isTree: boolean; // True if this edge is part of the visual tree structure
  isFeedback: boolean; // Explicit feedback loop
}

export default function AlgorithmMatrix({ algorithmId }: AlgorithmMatrixProps) {
  const alg = ALGORITHMS[algorithmId - 1] || ALGORITHMS[0];

  const { edges, positions, carriers } = useMemo(() => {
    const numOps = 6;
    const pos: Record<number, NodePosition> = {};
    const placed = new Set<number>();
    const treeEdges = new Set<string>(); // "from-to" strings

    // 1. Identify Carriers (Roots)
    // Sort to ensure consistent left-to-right order (e.g. 1, 3 for Alg 9)
    const carrierList = [...alg.outputMix].sort((a, b) => a - b);

    // 2. Recursive Layout Function
    // Returns the maximum X coordinate used by the subtree rooted at 'opIndex'
    function layoutNode(opIndex: number, startX: number, rank: number, path: Set<number>): number {
      if (placed.has(opIndex)) {
        // If node is already placed, we don't move it. 
        // Just return the current X to indicate no *new* width was consumed relative to startX.
        // However, if we are trying to place a shared node, it effectively ends this branch's width expansion.
        return startX - 1;
      }

      pos[opIndex] = { x: startX, y: rank };
      placed.add(opIndex);

      // Get Modulators (Children in the tree)
      // Filter out nodes that are already in the current recursion stack (cycles)
      const modulators = alg.modulationMatrix[opIndex];
      const validChildren = modulators.filter(m => !path.has(m));

      if (validChildren.length === 0) {
        return startX;
      }

      let currentChildX = startX;
      let maxSubTreeX = startX;

      // "Fill from directly above to the right"
      // The first child is placed directly above (same X).
      // Subsequent children are placed to the right of the previous child's subtree.
      validChildren.forEach((mod) => {
        // Record this as a structural tree edge
        treeEdges.add(`${mod}-${opIndex}`);

        const newPath = new Set(path).add(opIndex);
        const childMaxX = layoutNode(mod, currentChildX, rank + 1, newPath);

        if (childMaxX > maxSubTreeX) maxSubTreeX = childMaxX;

        // Next sibling starts after the current child's subtree
        currentChildX = childMaxX + 1;
      });

      // The width of this node is determined by its widest child subtree, 
      // but must be at least its own position (startX).
      return Math.max(startX, maxSubTreeX);
    }

    // 3. Layout each Carrier Tree
    let nextTreeStartX = 0;
    carrierList.forEach(c => {
      const treeWidth = layoutNode(c, nextTreeStartX, 0, new Set());
      // Start next tree after this tree's max width + 1 column gap
      nextTreeStartX = treeWidth + 1;
    });

    // 4. Generate Edges
    const rawEdges: Edge[] = [];
    alg.modulationMatrix.forEach((mods, carrier) => {
      mods.forEach(mod => {
        const isSelf = mod === carrier;
        const isTree = treeEdges.has(`${mod}-${carrier}`);

        // If it's not a tree edge, it's a feedback or cross-modulation edge
        // Usually visual feedback loops are those not in the main tree structure
        let isFeedback = isSelf || !isTree;

        rawEdges.push({ from: mod, to: carrier, isTree, isFeedback });
      });
    });

    return { edges: rawEdges, positions: pos, carriers: carrierList };
  }, [alg]);

  // Visual constants
  const boxW = 80;
  const boxH = 64;
  const gapX = 16;
  const gapY = 54;
  const svgW = 800; // Increased to provide more side room
  const svgH = 600; // Increased to prevent bottom clipping

  // Calculate centering offset
  let minL = Infinity, maxL = -Infinity;
  let maxRank = 0;
  (Object.values(positions) as NodePosition[]).forEach(p => {
    if (p.x < minL) minL = p.x;
    if (p.x > maxL) maxL = p.x;
    if (p.y > maxRank) maxRank = p.y;
  });

  const laneUnitPx = boxW + gapX;
  const totalContentWidth = (maxL - minL) * laneUnitPx + boxW;
  const totalContentHeight = (maxRank) * (boxH + gapY) + boxH;

  const offsetX = (svgW - totalContentWidth) / 2;
  // Position the bottom-most nodes (rank 0) so they aren't cut off
  const startYBase = svgH - ((svgH - totalContentHeight) / 2) - 20;
  const busY = startYBase + boxH + 10;

  // Map logic coords to SVG coords
  const getSvgPos = (id: number) => {
    const p = positions[id];
    if (!p) return { x: 0, y: 0 };
    return {
      x: offsetX + (p.x - minL) * laneUnitPx,
      y: startYBase - p.y * (boxH + gapY)
    };
  };

  return (
    <div className="bg-[#0b0b0b] p-3 lg:p-2 rounded border border-white/5 flex flex-col items-center justify-center h-full min-h-[140px] shadow-inner relative group">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] text-gray-700 font-bold uppercase tracking-[0.4em] opacity-50 group-hover:opacity-100 transition-opacity">
        ALGORITHM {algorithmId}
      </div>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
        {/* Render Connections */}
        {edges.map((edge, i) => {
          const p1 = getSvgPos(edge.from);
          const p2 = getSvgPos(edge.to);

          if (edge.isFeedback) {
            const color = "#00d4c1";
            // Self-loop
            if (edge.from === edge.to) {
              return (
                <g key={`fb-${i}`}>
                  <path
                    d={`M ${p1.x + boxW} ${p1.y + boxH / 2} L ${p1.x + boxW + 12} ${p1.y + boxH / 2} L ${p1.x + boxW + 12} ${p1.y - 12} L ${p1.x + boxW / 2} ${p1.y - 12} L ${p1.x + boxW / 2} ${p1.y}`}
                    fill="none" stroke={color} strokeWidth="3" className="drop-shadow-[0_0_6px_rgba(0,212,193,0.5)]"
                  />
                </g>
              );
            } else {
              // Complex feedback (side loop)
              // Draw curve around the right side
              const sideX = Math.max(p1.x, p2.x) + boxW + 16;
              // Adjust height to not overlap too much
              const topY = Math.min(p1.y, p2.y) - 4;
              return (
                <g key={`fb-${i}`}>
                  <path
                    d={`M ${p1.x + boxW} ${p1.y + boxH / 2} L ${sideX} ${p1.y + boxH / 2} L ${sideX} ${p2.y + boxH / 2} L ${p2.x + boxW} ${p2.y + boxH / 2}`}
                    fill="none" stroke={color} strokeWidth="3" strokeDasharray="5,2" className="drop-shadow-[0_0_8px_rgba(0,212,193,0.6)]"
                  />
                </g>
              );
            }
          }

          // Normal Tree Edge
          return (
            <line
              key={`edge-${i}`}
              x1={p1.x + boxW / 2} y1={p1.y + boxH}
              x2={p2.x + boxW / 2} y2={p2.y}
              stroke="#00d4c1" strokeWidth="3" opacity="0.8"
            />
          );
        })}

        {/* Output Bus */}
        {(() => {
          const carrierPos = carriers.map(c => {
            const p = getSvgPos(c);
            return { x: p.x + boxW / 2, y: p.y + boxH };
          });
          if (carrierPos.length === 0) return null;

          return (
            <g>
              {carrierPos.map((p, i) => (
                <line key={`bus-v-${i}`} x1={p.x} y1={p.y} x2={p.x} y2={busY} stroke="#00d4c1" strokeWidth="2.5" opacity="0.5" />
              ))}
              {carrierPos.length > 1 && (
                <line
                  x1={Math.min(...carrierPos.map(p => p.x))}
                  y1={busY}
                  x2={Math.max(...carrierPos.map(p => p.x))}
                  y2={busY}
                  stroke="#00d4c1" strokeWidth="2.5" opacity="0.5"
                />
              )}
            </g>
          );
        })()}

        {/* Render Operators */}
        {Object.entries(positions).map(([opIdx, pos]) => {
          const p = getSvgPos(parseInt(opIdx));
          return (
            <g key={opIdx}>
              <rect
                x={p.x} y={p.y} width={boxW} height={boxH}
                fill="#151515" stroke="#444" strokeWidth="3" rx="4"
              />
              <text
                x={p.x + boxW / 2} y={p.y + boxH / 2 + 8}
                fontSize="28" fill="#00d4c1" textAnchor="middle" fontWeight="bold"
                fontFamily="Orbitron" className="select-none pointer-events-none"
              >
                {parseInt(opIdx) + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute bottom-0 inset-x-4 h-px bg-gradient-to-r from-transparent via-dx7-teal/30 to-transparent"></div>
    </div>
  );
}