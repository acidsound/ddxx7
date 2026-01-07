import React, { useMemo } from 'react';
import { Patch } from '../types';
import ControlKnob from './ControlKnob';
import ControlFader from './ControlFader';

interface PitchEnvelopePanelProps {
  patch: Patch;
  onChange: (changes: Partial<Patch['pitchEnvelope']>) => void;
}

export default function PitchEnvelopePanel({ patch, onChange }: PitchEnvelopePanelProps) {
  const { rates, levels } = patch.pitchEnvelope;

  const updateRate = (idx: number, val: number) => {
    const next = [...rates] as [number, number, number, number];
    next[idx] = val;
    onChange({ rates: next });
  };

  const updateLevel = (idx: number, val: number) => {
    const next = [...levels] as [number, number, number, number];
    next[idx] = val;
    onChange({ levels: next });
  };

  const graphData = useMemo(() => {
    const width = 240;
    const height = 80;
    const getY = (l: number) => (1 - l / 99) * height;
    const getTime = (r: number) => Math.max(2, (100 - r) * 0.4);

    const t1 = getTime(rates[0]);
    const t2 = getTime(rates[1]);
    const t3 = getTime(rates[2]);
    const t4 = getTime(rates[3]);

    const totalT = t1 + t2 + t3 + t4;
    const scaleX = width / totalT;

    const p0 = { x: 0, y: getY(levels[3]) };
    const p1 = { x: t1 * scaleX, y: getY(levels[0]) };
    const p2 = { x: p1.x + t2 * scaleX, y: getY(levels[1]) };
    const p3 = { x: p2.x + t3 * scaleX, y: getY(levels[2]) };
    const p4 = { x: width, y: getY(levels[3]) };

    const lineD = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y}`;
    const fillD = `${lineD} L ${width} ${height} L 0 ${height} Z`;

    return { lineD, fillD };
  }, [rates, levels]);

  return (
    <div className="bg-[#1a1a1a] p-1.5 lg:p-1 border-none flex flex-col gap-2 lg:gap-1 shadow-2xl relative w-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-0.5 mb-0.5">
        <h3 className="text-[8px] font-bold text-gray-400 uppercase tracking-widest font-orbitron">Global Pitch Envelope</h3>
      </div>
      <div className="w-full bg-black/60 rounded-sm border border-white/5 p-0.5 h-[80px] lg:h-[60px] flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="w-full h-full opacity-80">
          <line x1="0" y1="40" x2="240" y2="40" stroke="#111" strokeWidth="1" />
          <path d={graphData.fillD} fill="#00d4c1" fillOpacity="0.2" />
          <path d={graphData.lineD} fill="none" stroke="#00d4c1" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex gap-2 justify-center py-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[6px] text-gray-400 font-bold uppercase tracking-tighter">LEVEL</span>
          <div className="flex flex-col items-center bg-black/30 p-1 rounded-sm border border-white/5 h-[106px] justify-center">
            <div className="flex gap-2 px-1">
              {levels.map((l, i) => (
                <ControlFader key={`l-${i}`} value={l} min={0} max={99} onChange={v => updateLevel(i, v)} height={88} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[6px] text-gray-400 font-bold uppercase tracking-tighter">RATE</span>
          <div className="flex flex-col items-center bg-black/30 p-1 rounded-sm border border-white/5 h-[106px] justify-center">
            <div className="flex gap-2 px-1">
              {rates.map((r, i) => (
                <ControlFader key={`r-${i}`} value={r} min={0} max={99} onChange={v => updateRate(i, v)} height={88} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="text-[7px] text-gray-400 font-bold uppercase tracking-widest text-center mt-auto opacity-70">
        PITCH EG
      </div>
    </div>
  );
}