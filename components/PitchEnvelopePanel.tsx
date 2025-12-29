import React, { useMemo } from 'react';
import { Patch } from '../types';
import ControlKnob from './ControlKnob';

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
    <div className="bg-[#121212] p-4 md:p-5 rounded border border-[#333] flex flex-col gap-4 h-full w-full shadow-2xl relative">
      <div className="flex items-center justify-between border-b border-white/5 pb-1 mb-1">
        <h3 className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] font-orbitron">Global Pitch Envelope</h3>
      </div>
      <div className="w-full bg-black rounded-sm border border-[#050505] shadow-[inset_0_2px_15px_rgba(0,0,0,1)] p-0.5 h-[90px] flex items-center justify-center relative overflow-hidden">
        <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="w-full h-full">
          <line x1="0" y1="40" x2="240" y2="40" stroke="#111" strokeWidth="1" />
          <line x1="0" y1="40" x2="240" y2="40" stroke="#00d4c1" strokeWidth="0.5" strokeDasharray="3,6" opacity="0.1" />
          <path d={graphData.fillD} fill="#00d4c1" fillOpacity="0.3" className="transition-all duration-300 ease-out" />
          <path d={graphData.lineD} fill="none" stroke="#00d4c1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className="transition-all duration-300 ease-out drop-shadow-[0_0_5px_rgba(0,212,193,0.6)]" />
        </svg>
      </div>
      <div className="flex flex-col gap-3 flex-grow justify-center">
        <div className="flex flex-col items-center">
           <span className="text-[10px] text-gray-400 font-bold tracking-wider mb-2 font-inter">Pitch EG Level</span>
           <div className="grid grid-cols-4 gap-2 md:gap-4 w-full px-2">
              {levels.map((l, i) => (
                <div key={`l-${i}`} className="flex flex-col items-center">
                   <ControlKnob label="" value={l} min={0} max={99} onChange={v => updateLevel(i, v)} />
                   <span className="text-[9px] font-bold text-gray-600 mt-1">{i+1}</span>
                </div>
              ))}
           </div>
        </div>
        <div className="flex flex-col items-center mt-1">
           <div className="grid grid-cols-4 gap-2 md:gap-4 w-full px-2">
              {rates.map((r, i) => (
                <div key={`r-${i}`} className="flex flex-col items-center">
                   <span className="text-[9px] font-bold text-gray-600 mb-1">{i+1}</span>
                   <ControlKnob label="" value={r} min={0} max={99} onChange={v => updateRate(i, v)} />
                </div>
              ))}
           </div>
           <span className="text-[10px] text-gray-400 font-bold tracking-wider mt-2 font-inter">Pitch EG Rate</span>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-1.5 opacity-20">
         <div className="w-1 h-1 bg-dx7-teal rounded-full"></div>
         <div className="w-1 h-1 bg-dx7-teal rounded-full"></div>
      </div>
    </div>
  );
}