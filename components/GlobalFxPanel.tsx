import React from 'react';
import { GlobalFxState } from '../types';
import ControlKnob from './ControlKnob';

interface GlobalFxPanelProps {
  value: GlobalFxState;
  onChange: (changes: Partial<GlobalFxState>) => void;
}

export default function GlobalFxPanel({ value, onChange }: GlobalFxPanelProps) {
  return (
    <div className="shrink-0 bg-[#080808] border-b border-[#222] px-3 py-1.5 z-40">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <div className="flex flex-col leading-none">
          <span className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.35em]">Global FX</span>
          <span className="text-[10px] font-orbitron text-dx7-teal uppercase tracking-[0.2em]">monotron delay</span>
        </div>
        <div className="flex items-center gap-4 bg-black/50 border border-white/5 rounded-sm px-3 py-1">
          <ControlKnob
            label="Dly Time"
            min={0}
            max={99}
            value={value.delayTime}
            onChange={v => onChange({ delayTime: v })}
            size={26}
            displayValue={v => `${v}`}
          />
          <ControlKnob
            label="Dly FB"
            min={0}
            max={99}
            value={value.delayFeedback}
            onChange={v => onChange({ delayFeedback: v })}
            size={26}
            displayValue={v => `${v}`}
          />
        </div>
      </div>
    </div>
  );
}
