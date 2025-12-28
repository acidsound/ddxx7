import React from 'react';

interface AlgorithmMatrixProps {
  algorithmId: number; // 1-32
}

// DX7 Routing Data (Carrier = Index 0, Feedback loop indicated by self-modulation)
const ROUTING_DATA: { [key: number]: { carriers: number[], connections: [number, number][], feedback: number } } = {
  1: { carriers: [1, 3], connections: [[2, 1], [4, 3], [5, 4], [6, 5]], feedback: 6 },
  2: { carriers: [1, 3], connections: [[2, 1], [2, 2], [4, 3], [5, 4], [6, 5]], feedback: 2 },
  3: { carriers: [1, 4], connections: [[2, 1], [3, 2], [5, 4], [6, 5]], feedback: 6 },
  4: { carriers: [1, 4], connections: [[2, 1], [3, 2], [5, 4], [6, 5], [4, 4]], feedback: 4 },
  5: { carriers: [1, 3, 5], connections: [[2, 1], [4, 3], [6, 5]], feedback: 6 },
  6: { carriers: [1, 3, 5], connections: [[2, 1], [4, 3], [6, 5], [5, 5]], feedback: 5 },
  7: { carriers: [1, 3], connections: [[2, 1], [4, 3], [5, 3], [6, 5]], feedback: 6 },
  8: { carriers: [1, 3], connections: [[2, 1], [4, 3], [5, 3], [4, 4]], feedback: 4 },
  9: { carriers: [1, 3], connections: [[2, 1], [2, 2], [4, 3], [5, 3], [6, 3]], feedback: 2 },
  10: { carriers: [1, 4], connections: [[2, 1], [3, 1], [5, 4], [6, 4]], feedback: 3 },
  11: { carriers: [1, 4], connections: [[2, 1], [3, 1], [5, 4], [6, 4], [6, 6]], feedback: 6 },
  12: { carriers: [1, 3], connections: [[2, 1], [2, 2], [4, 3], [5, 3], [6, 3]], feedback: 2 },
  13: { carriers: [1, 3], connections: [[2, 1], [4, 3], [5, 3], [6, 3], [6, 6]], feedback: 6 },
  14: { carriers: [1, 3], connections: [[2, 1], [4, 3], [5, 4], [6, 4], [6, 6]], feedback: 6 },
  15: { carriers: [1, 3], connections: [[2, 1], [2, 2], [4, 3], [5, 4], [6, 4]], feedback: 2 },
  16: { carriers: [1], connections: [[2, 1], [3, 1], [5, 1], [4, 3], [6, 5]], feedback: 6 },
  17: { carriers: [1], connections: [[2, 1], [2, 2], [3, 1], [5, 1], [4, 3], [6, 5]], feedback: 2 },
  18: { carriers: [1], connections: [[2, 1], [3, 1], [4, 1], [5, 2], [6, 5]], feedback: 3 },
  19: { carriers: [1, 4, 5], connections: [[2, 1], [3, 2], [6, 5]], feedback: 6 },
  20: { carriers: [1, 2, 4], connections: [[3, 1], [3, 2], [3, 3], [5, 4], [6, 4]], feedback: 3 },
  21: { carriers: [1, 2, 4, 5], connections: [[3, 1], [3, 2], [3, 3], [6, 5]], feedback: 3 },
  22: { carriers: [1, 3, 4, 5], connections: [[2, 1], [6, 5]], feedback: 6 },
  23: { carriers: [1, 2, 4, 5, 6], connections: [[3, 2]], feedback: 6 },
  24: { carriers: [1, 2, 3, 4, 5], connections: [[6, 5]], feedback: 6 },
  25: { carriers: [1, 2, 3, 4, 5, 6], connections: [[6, 6]], feedback: 6 },
  26: { carriers: [1, 2, 4], connections: [[3, 2], [5, 4], [6, 5]], feedback: 6 },
  27: { carriers: [1, 2, 4], connections: [[3, 2], [3, 3], [5, 4], [6, 4]], feedback: 3 },
  28: { carriers: [1, 3, 6], connections: [[2, 1], [4, 3], [5, 4]], feedback: 5 },
  29: { carriers: [1, 2, 3, 5], connections: [[4, 3], [6, 5]], feedback: 6 },
  30: { carriers: [1, 2, 3, 6], connections: [[4, 3], [5, 4]], feedback: 5 },
  31: { carriers: [1, 2, 3, 4, 5], connections: [[6, 5]], feedback: 6 },
  32: { carriers: [1, 2, 3, 4, 5, 6], connections: [[6, 6]], feedback: 6 },
};

const AlgorithmMatrix: React.FC<AlgorithmMatrixProps> = ({ algorithmId }) => {
  const data = ROUTING_DATA[algorithmId] || ROUTING_DATA[1];

  const ranks: { [key: number]: number } = {};
  
  const calculateRank = (op: number, currentRank: number) => {
    ranks[op] = Math.max(ranks[op] || 0, currentRank);
    data.connections.forEach(([mod, car]) => {
      if (car === op && mod !== op) calculateRank(mod, currentRank + 1);
    });
  };

  data.carriers.forEach(c => calculateRank(c, 0));

  const maxRank = Math.max(...Object.values(ranks), 0);
  const opsByRank: number[][] = Array.from({ length: maxRank + 1 }, () => []);
  Object.entries(ranks).forEach(([op, rank]) => opsByRank[rank].push(parseInt(op)));
  
  for(let i=1; i<=6; i++) if(ranks[i] === undefined) {
    if (opsByRank[0]) opsByRank[0].push(i);
  }

  const boxW = 12;
  const boxH = 10;
  const gapX = 4;
  const gapY = 12;
  const svgW = 100;
  const svgH = 80;

  const positions: { [key: number]: { x: number, y: number } } = {};
  opsByRank.forEach((ops, rank) => {
    const sortedOps = [...ops].sort((a, b) => a - b);
    const rowWidth = (sortedOps.length * boxW + (sortedOps.length - 1) * gapX);
    const startX = (svgW - rowWidth) / 2;
    
    sortedOps.forEach((op, i) => {
      positions[op] = {
        x: startX + i * (boxW + gapX),
        y: svgH - 18 - rank * (boxH + gapY)
      };
    });
  });

  return (
    <div className="bg-[#111] p-3 rounded border border-[#333] flex flex-col items-center justify-center h-full min-h-[120px]">
      <div className="text-[7px] text-gray-600 font-bold uppercase mb-2 tracking-[0.2em]">Algorithm {algorithmId}</div>
      <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible preserve-3d">
        {/* Connections */}
        {data.connections.map(([mod, car], i) => {
            if (mod === car) return null;
            const p1 = positions[mod];
            const p2 = positions[car];
            if(!p1 || !p2) return null;
            return (
                <line 
                    key={i} 
                    x1={p1.x + boxW/2} y1={p1.y + boxH} 
                    x2={p2.x + boxW/2} y2={p2.y} 
                    stroke="#00d4c1" strokeWidth="0.7" opacity="0.4"
                />
            );
        })}

        {/* Feedback loop */}
        {data.feedback && positions[data.feedback] && (
            <path 
                d={`M ${positions[data.feedback].x + boxW} ${positions[data.feedback].y + boxH/2} 
                   L ${positions[data.feedback].x + boxW + 3} ${positions[data.feedback].y + boxH/2}
                   L ${positions[data.feedback].x + boxW + 3} ${positions[data.feedback].y - 3}
                   L ${positions[data.feedback].x + boxW/2} ${positions[data.feedback].y - 3}
                   L ${positions[data.feedback].x + boxW/2} ${positions[data.feedback].y}`}
                fill="none" stroke="#00d4c1" strokeWidth="0.7" opacity="0.8"
            />
        )}

        {/* Operators */}
        {Object.entries(positions).map(([op, pos]) => (
          <g key={op}>
            <rect 
                x={pos.x} y={pos.y} width={boxW} height={boxH} 
                fill="#1a1a1a" stroke="#444" strokeWidth="0.5" rx="1" 
            />
            <text 
                x={pos.x + boxW/2} y={pos.y + boxH/2 + 2.5} 
                fontSize="6" fill="#00d4c1" textAnchor="middle" fontWeight="bold" 
                fontFamily="Orbitron"
            >
              {op}
            </text>
          </g>
        ))}

        {/* Output Indicator Lines for Carriers */}
        {data.carriers.map(c => {
          if (!positions[c]) return null;
          return (
            <line 
              key={`out-${c}`}
              x1={positions[c].x + boxW/2} y1={positions[c].y + boxH} 
              x2={positions[c].x + boxW/2} y2={svgH - 6} 
              stroke="#00d4c1" strokeWidth="0.5" strokeDasharray="1,1" opacity="0.2"
            />
          );
        })}
      </svg>
    </div>
  );
};

export default AlgorithmMatrix;