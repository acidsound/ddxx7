import React, { useMemo } from 'react';
import { OperatorParams } from '../types';
import ControlKnob from './ControlKnob';
import ControlFader from './ControlFader';

interface OperatorPanelProps {
  key?: React.Key;
  index: number;
  params: OperatorParams;
  level?: number;
  envState?: number;
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

const OperatorPanel: React.FC<OperatorPanelProps> = ({ index, params, level, envState, onChange }) => {
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

    // Use a staged weighting to ensure visibility of all phases regardless of rate
    // Each stage gets at least 15% of width, remaining distributed exponentially
    const getWeights = (rates: number[]) => {
      const BASE_W = 20; // Min pixels per stage
      const rawWeights = rates.map(r => Math.pow(1.045, 100 - r));
      const totalRaw = rawWeights.reduce((a, b) => a + b, 0);
      const remainingW = width - (BASE_W * 4);
      return rawWeights.map(rw => BASE_W + (rw / totalRaw) * remainingW);
    };

    const ws = getWeights(params.rates);

    // Fixed Note 60 boost for visualization (representative view)
    const rksBoost = Math.floor(params.keyScaleRate * (60 - 21) / 8);
    const getEffectiveT = (r: number, w: number) => {
      const effectiveR = Math.min(99, r + rksBoost);
      // For high rates, make the segment visually shorter to look like "\"
      if (effectiveR > 90) return 5;
      return w;
    };

    const t1 = getEffectiveT(params.rates[0], ws[0]);
    const t2 = ws[1];
    const t3 = ws[2];
    const t4 = ws[3];

    // Redistribution to keep width fixed
    const totalT = t1 + t2 + t3 + t4;
    const sx = width / totalT;

    const p0 = { x: 0, y: getY(params.levels[3]) };
    const p1 = { x: t1 * sx, y: getY(params.levels[0]) };
    const p2 = { x: p1.x + t2 * sx, y: getY(params.levels[1]) };
    const p3 = { x: p2.x + t3 * sx, y: getY(params.levels[2]) };
    const p4 = { x: width, y: getY(params.levels[3]) };

    const lineD = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y}`;

    const fillD = `${lineD} L ${width} ${height} L 0 ${height} Z`;

    return { lineD, fillD, points: [p0, p1, p2, p3, p4] };
  }, [params.rates, params.levels, params.keyScaleRate]);

  const isActive = params.volume > 0;

  const toggleOperator = () => {
    update('volume', isActive ? 0 : 99);
  };

  return (
    <div className={`flex items-center border-b border-white/10 transition-all relative w-full ${isActive ? 'bg-[#1a1a1a]' : 'bg-[#0f0f0f] opacity-60'}`}>

      {/* Sidebar Toggle Section */}
      <div className="flex flex-col items-center justify-center min-w-[80px] w-[80px] lg:min-w-[40px] lg:w-[40px] h-full border-r border-white/5 bg-black/40 shrink-0 z-10 relative overflow-hidden">

        <button
          onClick={toggleOperator}
          className={`relative z-10 w-10 h-10 lg:w-7 lg:h-7 rounded-sm flex items-center justify-center border transition-all font-orbitron font-bold text-sm lg:text-[10px] active:scale-90 select-none ${isActive ? 'bg-black text-dx7-teal border-dx7-teal shadow-[0_0_15px_rgba(0,212,193,0.3)]' : 'bg-[#080808] text-gray-700 border-[#1a1a1a]'}`}
        >
          {index}
        </button>

        {/* High Visibility Level Meter (Right Edge) */}
        <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-black/50">
          <div
            className="absolute bottom-0 left-0 right-0 bg-dx7-teal shadow-[0_0_8px_#00d4c1] transition-all duration-75 ease-out"
            style={{ height: `${Math.min(100, (level || 0) * 150)}%` }} // Increased sensitivity (1.5x)
          />
        </div>
      </div>

      {/* Control Surface */}
      <div className="flex-grow flex items-center overflow-x-auto lg:overflow-x-auto no-scrollbar px-2.5 lg:px-1 pt-3 pb-2">
        <div className="flex items-center gap-2.5 lg:gap-0.5 min-w-max">

          <div className="flex gap-2.5 items-center shrink-0">
            <div className="flex gap-1.5 items-center bg-[#1d1813] p-1 rounded-sm border border-[#2d251d] h-[72px]">
              <ControlKnob label="VEL" min={0} max={7} value={params.velocitySens} onChange={v => update('velocitySens', v)} size={32} />
              <ControlKnob label="A.MOD" min={0} max={3} value={params.lfoAmpModSens} onChange={v => update('lfoAmpModSens', v)} size={32} />
              <ControlKnob label="LEVEL" min={0} max={99} value={params.volume} onChange={v => update('volume', v)} size={32} />
            </div>

            <div className="flex gap-1.5 items-center bg-[#0a0a0a] p-1 px-2 rounded-sm border border-white/5 h-[72px]">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => update('oscMode', params.oscMode === 0 ? 1 : 0)}
                  className={`w-7 h-6 rounded-sm border transition-all flex items-center justify-center font-bold text-[7px] tracking-tight ${params.oscMode === 1 ? 'border-dx7-teal bg-dx7-teal/20 text-dx7-teal' : 'border-[#333] text-gray-500'}`}
                >
                  {params.oscMode === 0 ? 'RT' : 'FX'}
                </button>
                <span className="text-[6px] text-gray-400 font-bold uppercase">MODE</span>
              </div>
              <ControlKnob label="COARSE" min={0} max={31} value={params.freqCoarse} onChange={v => update('freqCoarse', v)} size={32} />
              <ControlKnob label="FINE" min={0} max={99} value={params.freqFine} onChange={v => update('freqFine', v)} size={32} />
              <ControlKnob label="DET" min={0} max={14} value={params.detune} onChange={v => update('detune', v)} displayValue={params.detune - 7} size={32} />
            </div>
          </div>

          {/* Keyboard Scaling Block */}
          <div className="flex gap-2.5 p-1 bg-[#1d1813] rounded-sm border border-[#2d251d] shrink-0 h-[72px] items-center">
            <ControlKnob label="L.DEP" min={0} max={99} value={params.keyScaleDepthL} onChange={v => update('keyScaleDepthL', v)} size={32} />
            <div className="flex flex-col items-center gap-0.5 group shrink-0">
              <button
                onClick={() => update('keyScaleCurveL', (params.keyScaleCurveL + 1) % 4)}
                className="w-7 h-6 bg-black/80 rounded-sm border border-[#330] p-1 hover:border-dx7-teal/40 transition-colors"
              >
                <CurveIcon type={params.keyScaleCurveL} />
              </button>
              <span className="text-[6px] text-gray-400 font-bold uppercase">L-CRV</span>
            </div>
            <ControlKnob label="BRK" min={0} max={99} value={params.keyScaleBreakpoint} onChange={v => update('keyScaleBreakpoint', v)} size={32} displayValue={getNoteName} />
            <ControlKnob label="RATE" min={0} max={7} value={params.keyScaleRate} onChange={v => update('keyScaleRate', v)} size={32} />
            <div className="flex flex-col items-center gap-0.5 group shrink-0">
              <button
                onClick={() => update('keyScaleCurveR', (params.keyScaleCurveR + 1) % 4)}
                className="w-7 h-6 bg-black/80 rounded-sm border border-[#330] p-1 hover:border-dx7-teal/40 transition-colors"
              >
                <CurveIcon type={params.keyScaleCurveR} mirrored={true} />
              </button>
              <span className="text-[6px] text-gray-400 font-bold uppercase">R-CRV</span>
            </div>
            <ControlKnob label="R.DEP" min={0} max={99} value={params.keyScaleDepthR} onChange={v => update('keyScaleDepthR', v)} size={32} />
          </div>

          {/* Envelope Section */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/5 shrink-0 h-[72px]">
            <div className="w-[100px] bg-black rounded-sm border border-white/5 shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] p-0.5 h-full flex items-center justify-center relative overflow-hidden">
              <svg viewBox="0 0 160 90" preserveAspectRatio="none" className="w-full h-full">
                {/* Solid Fill Background */}
                <path d={graphData.fillD} fill="#00d4c1" fillOpacity="0.08" />

                {/* Pre-rendered lines for all 4 stages to prevent DOM thrashing/flickering */}
                {[0, 1, 2, 3].map(i => (
                  <line
                    key={i}
                    x1={graphData.points[i].x}
                    y1={graphData.points[i].y}
                    x2={graphData.points[i + 1].x}
                    y2={graphData.points[i + 1].y}
                    stroke={envState === i ? "#ffffff" : "#ffffff"}
                    strokeOpacity={envState === i ? 1 : 0.2}
                    strokeWidth={envState === i ? (envState === i ? 2 : 1) : 1}
                    className="transition-[stroke-opacity,stroke-width] duration-150"
                  />
                ))}
              </svg>
            </div>

            <div className="flex flex-col items-center gap-1">
              <span className="text-[6px] text-gray-400 font-bold uppercase tracking-tighter">LEVEL</span>
              <div className="flex flex-col items-center bg-black/30 p-1 rounded-sm border border-white/5 h-[62px] justify-center">
                <div className="flex gap-2 items-center px-1">
                  {params.levels.map((l, i) => (
                    <ControlFader key={`l-${i}`} value={l} min={0} max={99} onChange={v => updateArray('levels', i, v)} height={44} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[6px] text-gray-400 font-bold uppercase tracking-tighter">RATE</span>
              <div className="flex flex-col items-center bg-black/30 p-1 rounded-sm border border-white/5 h-[62px] justify-center">
                <div className="flex gap-2 items-center px-1">
                  {params.rates.map((r, i) => (
                    <ControlFader key={`r-${i}`} value={r} min={0} max={99} onChange={v => updateArray('rates', i, v)} height={44} />
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OperatorPanel;