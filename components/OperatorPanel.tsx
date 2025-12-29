import React, { useMemo } from 'react';
import { OperatorParams } from '../types';
import ControlKnob from './ControlKnob';

interface OperatorPanelProps {
  index: number;
  params: OperatorParams;
  onChange: (newParams: OperatorParams) => void;
}

const CURVE_NAMES = ['-LN', '-EX', '+EX', '+LN'];

const getNoteName = (value: number) => {
  const midiNote = value + 21; // DX7: 0 = A-1 (21), 99 = C8 (120)
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = notes[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 2;
  return `${name}${octave}`;
};

const CurveIcon: React.FC<{ type: number; mirrored?: boolean }> = ({ type, mirrored }) => {
  // 0: -LN, 1: -EX, 2: +EX, 3: +LN
  const paths = [
    "M 4 16 L 16 4",       // Linear (Falling or Rising depending on mirror)
    "M 4 16 Q 16 16 16 4", // Convex
    "M 4 16 Q 4 4 16 4",   // Concave
    "M 4 4 L 16 16"        // Linear falling
  ];
  return (
    <svg 
      viewBox="0 0 20 20" 
      className="w-full h-full text-dx7-teal opacity-80 group-hover:opacity-100 transition-opacity"
      style={{ transform: mirrored ? 'scaleX(-1)' : 'none' }}
    >
      <path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};

export default function OperatorPanel({ index, params, onChange }: OperatorPanelProps) {
  const update = (field: keyof OperatorParams, value: any) => {
    onChange({ ...params, [field]: value });
  };

  const updateArray = (field: 'rates' | 'levels', idx: number, val: number) => {
    const next = [...params[field]] as [number, number, number, number];
    next[idx] = val;
    onChange({ ...params, [field]: next });
  };

  const graphData = useMemo(() => {
    const width = 160;
    const height = 90;
    const getY = (l: number) => (1 - l / 99) * height;
    const getTime = (r: number) => Math.max(2, (100 - r) * 0.4);

    const t1 = getTime(params.rates[0]);
    const t2 = getTime(params.rates[1]);
    const t3 = getTime(params.rates[2]);
    const t4 = getTime(params.rates[3]);
    
    const totalT = t1 + t2 + t3 + t4;
    const scaleX = width / totalT;

    const p0 = { x: 0, y: getY(params.levels[3]) };
    const p1 = { x: t1 * scaleX, y: getY(params.levels[0]) };
    const p2 = { x: p1.x + t2 * scaleX, y: getY(params.levels[1]) };
    const p3 = { x: p2.x + t3 * scaleX, y: getY(params.levels[2]) };
    const p4 = { x: width, y: getY(params.levels[3]) };

    const lineD = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y}`;
    const fillD = `${lineD} L ${width} ${height} L 0 ${height} Z`;
    
    return { lineD, fillD };
  }, [params.rates, params.levels]);

  const isActive = params.volume > 0;

  const toggleOperator = () => {
    update('volume', isActive ? 0 : 99);
  };

  return (
    <div className={`flex items-center h-[280px] border-b border-[#222] transition-all relative w-full overflow-hidden ${isActive ? 'bg-[#141414]' : 'bg-[#0f0f0f] opacity-60'}`}>
      
      {/* Sidebar Toggle Section */}
      <div className="flex flex-col items-center justify-center min-w-[80px] w-[80px] h-full border-r border-[#222] bg-black/40 shrink-0 z-10">
        <button 
          onClick={toggleOperator}
          className={`w-10 h-10 rounded flex items-center justify-center border transition-all font-orbitron font-bold text-sm active:scale-90 select-none ${isActive ? 'bg-black text-dx7-teal border-dx7-teal shadow-[0_0_15px_rgba(0,212,193,0.3)]' : 'bg-[#080808] text-gray-700 border-[#1a1a1a]'}`}
        >
          {index}
        </button>
      </div>

      {/* Control Surface */}
      <div className="flex-grow h-full flex items-center overflow-x-auto no-scrollbar px-8 py-4">
        <div className="flex items-center gap-8 min-w-max">
          
          {/* Operator Tuning Block */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center bg-[#1d1813] p-4 rounded-lg border border-[#2d251d] shadow-2xl">
              <ControlKnob label="A MOD SENS" min={0} max={3} value={params.lfoAmpModSens} onChange={v => update('lfoAmpModSens', v)} size={42} />
              <ControlKnob label="KEY VEL" min={0} max={7} value={params.velocitySens} onChange={v => update('velocitySens', v)} size={42} />
              <ControlKnob label="LEVEL" min={0} max={99} value={params.volume} onChange={v => update('volume', v)} size={54} />
            </div>
            
            <div className="flex gap-4 items-center bg-[#0a0a0a] p-3 px-4 rounded-lg border border-white/5 shadow-inner">
              <div className="flex flex-col items-center gap-1.5">
                <button 
                  onClick={() => update('oscMode', params.oscMode === 0 ? 1 : 0)}
                  className={`w-10 h-8 rounded border transition-all flex items-center justify-center font-bold text-[8px] tracking-tight ${params.oscMode === 1 ? 'border-dx7-teal bg-dx7-teal/20 text-dx7-teal' : 'border-[#333] text-gray-500'}`}
                >
                  {params.oscMode === 0 ? 'RATIO' : 'FIXED'}
                </button>
                <span className="text-[7px] text-gray-700 font-bold uppercase">MODE</span>
              </div>
              <ControlKnob label="COARSE" min={0} max={31} value={params.freqCoarse} onChange={v => update('freqCoarse', v)} size={38} />
              <ControlKnob label="FINE" min={0} max={99} value={params.freqFine} onChange={v => update('freqFine', v)} size={38} />
              <ControlKnob label="DETUNE" min={0} max={14} value={params.detune} onChange={v => update('detune', v)} displayValue={params.detune - 7} size={38} />
            </div>
          </div>

          {/* Keyboard Scaling Block */}
          <div className="flex flex-col gap-4 p-5 bg-[#1d1813] rounded-lg border border-[#2d251d] shadow-2xl min-w-[240px]">
            <div className="grid grid-cols-3 gap-x-4 items-start justify-items-center">
              <ControlKnob label="L DEPTH" min={0} max={99} value={params.keyScaleDepthL} onChange={v => update('keyScaleDepthL', v)} size={34} />
              <ControlKnob label="BREAKPOINT" min={0} max={99} value={params.keyScaleBreakpoint} onChange={v => update('keyScaleBreakpoint', v)} size={38} displayValue={getNoteName} />
              <ControlKnob label="R DEPTH" min={0} max={99} value={params.keyScaleDepthR} onChange={v => update('keyScaleDepthR', v)} size={34} />
            </div>
            <div className="grid grid-cols-3 gap-x-4 items-end justify-items-center">
              <div className="flex flex-col items-center gap-1.5 group">
                <button 
                  onClick={() => update('keyScaleCurveL', (params.keyScaleCurveL + 1) % 4)}
                  className="w-12 h-9 bg-black/80 rounded border border-[#333] p-2 hover:border-dx7-teal/40 transition-colors"
                >
                  <CurveIcon type={params.keyScaleCurveL} />
                </button>
                <span className="text-[8px] text-white/70 font-bold">{CURVE_NAMES[params.keyScaleCurveL]}</span>
                <span className="text-[7px] text-gray-500 font-bold uppercase">L CURVE</span>
              </div>
              <ControlKnob label="RATE SCALE" min={0} max={7} value={params.keyScaleRate} onChange={v => update('keyScaleRate', v)} size={34} />
              <div className="flex flex-col items-center gap-1.5 group">
                <button 
                  onClick={() => update('keyScaleCurveR', (params.keyScaleCurveR + 1) % 4)}
                  className="w-12 h-9 bg-black/80 rounded border border-[#333] p-2 hover:border-dx7-teal/40 transition-colors"
                >
                  <CurveIcon type={params.keyScaleCurveR} mirrored={true} />
                </button>
                <span className="text-[8px] text-white/70 font-bold">{CURVE_NAMES[params.keyScaleCurveR]}</span>
                <span className="text-[7px] text-gray-500 font-bold uppercase">R CURVE</span>
              </div>
            </div>
          </div>

          {/* Envelope Section */}
          <div className="flex items-center gap-8 pl-4 border-l border-white/5">
            <div className="w-[180px] bg-black rounded border border-black/40 shadow-inner p-1 h-[140px] flex items-center justify-center relative">
               <svg viewBox="0 0 160 90" preserveAspectRatio="none" className="w-full h-full">
                  <path d={graphData.fillD} fill="#00d4c1" fillOpacity="0.15" />
                  <path d={graphData.lineD} fill="none" stroke="#00d4c1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_4px_rgba(0,212,193,0.7)]" />
               </svg>
               <span className="absolute bottom-2 right-2 text-[8px] font-bold text-gray-700 font-mono opacity-50 uppercase">ENV {index}</span>
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center">
                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mb-2">LEVEL</span>
                <div className="flex gap-4">
                  {params.levels.map((l, i) => (
                    <div key={`l-${i}`} className="flex flex-col items-center">
                      <ControlKnob label="" value={l} min={0} max={99} onChange={v => updateArray('levels', i, v)} size={30} />
                      <span className="text-[8px] font-bold text-gray-700 mt-1">{i+1}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex gap-4">
                  {params.rates.map((r, i) => (
                    <div key={`r-${i}`} className="flex flex-col items-center">
                      <span className="text-[8px] font-bold text-gray-700 mb-1">{i+1}</span>
                      <ControlKnob label="" value={r} min={0} max={99} onChange={v => updateArray('rates', i, v)} size={30} />
                    </div>
                  ))}
                </div>
                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-2">RATE</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}