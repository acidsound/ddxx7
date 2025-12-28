
import React from 'react';
import { OperatorParams } from '../types';
import ControlKnob from './ControlKnob';
import ControlSlider from './ControlSlider';

interface OperatorPanelProps {
  index: number;
  params: OperatorParams;
  onChange: (newParams: OperatorParams) => void;
}

const OperatorPanel: React.FC<OperatorPanelProps> = ({ index, params, onChange }) => {
  const update = (field: keyof OperatorParams, value: any) => {
    onChange({ ...params, [field]: value });
  };

  const updateArray = (field: 'rates' | 'levels', idx: number, val: number) => {
    const next = [...params[field]] as [number, number, number, number];
    next[idx] = val;
    onChange({ ...params, [field]: next });
  };

  const isActive = params.volume > 0;

  return (
    <div className={`flex items-center gap-2 md:gap-4 py-6 px-0 border-b border-[#333] transition-all overflow-x-auto no-scrollbar relative w-full ${isActive ? 'bg-[#242424]' : 'bg-[#1a1a1a] opacity-60'}`}>
      {/* Op Number & Toggle */}
      <div className="flex flex-col items-center gap-2 min-w-[60px] pl-2 md:pl-4">
        {/* Operator Number Box: Border color unified to #333 for both states */}
        <div className={`w-8 h-8 rounded-sm flex items-center justify-center border border-[#333] transition-all font-orbitron font-bold text-xs ${isActive ? 'bg-black text-dx7-teal' : 'bg-[#111] text-gray-600'}`}>
          {index}
        </div>
        
        {/* Classic Rectangular Membrane Toggle Switch - Border color unified to #333 for both states */}
        <button 
          onClick={() => update('volume', isActive ? 0 : 99)}
          className={`w-11 h-6 rounded-sm p-[1.5px] transition-all duration-200 border border-[#333] flex items-center ${isActive ? 'bg-[#004d47] shadow-[inset_0_0_10px_rgba(0,0,0,0.6)]' : 'bg-[#0a0a0a]'}`}
        >
          <div className={`h-full w-5 rounded-[1px] transition-all duration-300 transform shadow-sm flex items-center justify-center ${isActive ? 'translate-x-0 bg-[#7efab4]' : 'translate-x-5 bg-[#333]'}`}>
            {/* Texture detail for handle - darker contrast when handle is bright */}
            <div className={`w-[1px] h-3 mx-[1px] ${isActive ? 'bg-[#004d47]/40' : 'bg-black/40'}`}></div>
            <div className={`w-[1px] h-3 mx-[1px] ${isActive ? 'bg-[#004d47]/40' : 'bg-black/40'}`}></div>
          </div>
        </button>
        
        <span className={`text-[7px] font-bold uppercase tracking-wider transition-colors ${isActive ? 'text-dx7-teal/60' : 'text-gray-600'}`}>ON/OFF</span>
      </div>

      {/* Basic Controls */}
      <div className="flex gap-4 border-l border-[#333] pl-2 md:pl-4">
        <ControlKnob label="Level" min={0} max={99} value={params.volume} onChange={v => update('volume', v)} />
        <ControlKnob label="Pan" min={-50} max={50} value={Math.round((params.ampR - 0.5) * 100)} onChange={v => {
          const ratio = (v + 50) / 100;
          update('ampL', 1 - ratio);
          update('ampR', ratio);
        }} />
        <ControlKnob label="Vel Sens" min={0} max={7} value={params.velocitySens} onChange={v => update('velocitySens', v)} />
        <ControlKnob label="LFO Sens" min={0} max={7} value={params.lfoAmpModSens} onChange={v => update('lfoAmpModSens', v)} />
      </div>

      {/* Frequency Section */}
      <div className="flex gap-4 border-l border-[#333] pl-2 md:pl-4 bg-black/20 p-2 rounded mx-1">
        <div className="flex flex-col items-center gap-1">
          <button 
            onClick={() => update('oscMode', params.oscMode === 0 ? 1 : 0)}
            className={`w-8 h-8 rounded border-2 transition-all flex items-center justify-center ${params.oscMode === 1 ? 'border-dx7-teal bg-dx7-bg-teal/20 text-dx7-teal' : 'border-[#444] text-gray-600'}`}
          >
            <span className="text-[10px] font-bold">{params.oscMode === 0 ? 'RAT' : 'FIX'}</span>
          </button>
          <span className="text-[7px] text-gray-500 uppercase font-bold">OSC MODE</span>
        </div>
        <div className="relative">
          <ControlKnob label="Coarse" min={0} max={31} value={params.freqCoarse} onChange={v => update('freqCoarse', v)} />
        </div>
        <ControlKnob label="Fine" min={0} max={99} value={params.freqFine} onChange={v => update('freqFine', v)} />
        <ControlKnob label="Detune" min={0} max={14} value={params.detune} onChange={v => update('detune', v)} displayValue={params.detune - 7} />
      </div>

      {/* EG Rate */}
      <div className="flex gap-1 border-l border-[#333] pl-2 md:pl-4">
        <div className="text-[7px] text-gray-600 font-bold uppercase -rotate-90 h-full flex items-center self-center w-2">Rates</div>
        {params.rates.map((r, i) => <ControlSlider key={i} label={`R${i+1}`} value={r} min={0} max={99} onChange={v => updateArray('rates', i, v)} />)}
      </div>

      {/* EG Level */}
      <div className="flex gap-1 border-l border-[#333] pl-2 md:pl-4">
        <div className="text-[7px] text-gray-600 font-bold uppercase -rotate-90 h-full flex items-center self-center w-2">Levels</div>
        {params.levels.map((l, i) => <ControlSlider key={i} label={`L${i+1}`} value={l} min={0} max={99} onChange={v => updateArray('levels', i, v)} />)}
      </div>

      {/* Key Scaling Section */}
      <div className="flex gap-3 border-l border-[#333] pl-2 md:pl-4 opacity-50 pr-4">
        <ControlKnob label="Rate" min={0} max={7} value={params.keyScaleRate} onChange={v => update('keyScaleRate', v)} />
        <ControlKnob label="Breakpt" min={0} max={99} value={params.keyScaleBreakpoint} onChange={v => update('keyScaleBreakpoint', v)} />
        <ControlKnob label="Depth L" min={0} max={99} value={params.keyScaleDepthL} onChange={v => update('keyScaleDepthL', v)} />
        <ControlKnob label="Depth R" min={0} max={99} value={params.keyScaleDepthR} onChange={v => update('keyScaleDepthR', v)} />
      </div>
    </div>
  );
};

export default OperatorPanel;
