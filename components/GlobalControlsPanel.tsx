import React from 'react';
import { Patch } from '../types';
import ControlKnob from './ControlKnob';
import ToggleSwitch from './ToggleSwitch';

interface GlobalControlsPanelProps {
  patch: Patch;
  onChange: (changes: Partial<Patch>) => void;
}

const LFO_WAVEFORMS = ['TRI', 'SAW↓', 'SAW↑', 'SQR', 'SINE', 'S/H'];

export default function GlobalControlsPanel({ patch, onChange }: GlobalControlsPanelProps) {
  const renderWaveIcon = () => {
    const waveforms = [
      "M 0 10 L 5 0 L 10 10 L 15 20 L 20 10", // Tri
      "M 0 0 L 20 20 L 20 0", // Saw Down
      "M 0 20 L 20 0 L 20 20", // Saw Up
      "M 0 20 L 0 0 L 10 0 L 10 20 L 20 20 L 20 0", // Sqr
      "M 0 10 Q 5 -5 10 10 Q 15 25 20 10", // Sine
      "M 0 10 L 4 10 L 4 16 L 8 16 L 8 4 L 12 4 L 12 12 L 16 12 L 16 8 L 20 8" // S/H (Irregular Square/Staircase)
    ];
    return (
      <svg viewBox="0 0 20 20" className="w-8 h-8 text-dx7-teal">
        <path d={waveforms[patch.lfoWaveform]} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <div className="bg-[#1a1a1a] p-1.5 lg:p-1 border-none flex flex-col gap-2 shadow-xl w-full">
      <div className="flex items-center justify-between border-b border-white/5 pb-0.5 mb-0.5">
        <h3 className="text-[8px] font-bold text-gray-500 uppercase tracking-widest font-orbitron">Global Tone generator</h3>
      </div>
      {/* LFO Modulation Section */}
      <div className="flex flex-col gap-3 lg:gap-1.5">
        <div className="grid grid-cols-3 gap-y-3 lg:gap-y-1 gap-x-1 items-start justify-items-center">
          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
            <button
              onClick={() => onChange({ lfoWaveform: (patch.lfoWaveform + 1) % LFO_WAVEFORMS.length })}
              className="w-10 h-8 lg:w-9 lg:h-7 bg-black rounded-sm border border-white/5 flex items-center justify-center hover:border-dx7-teal/40 transition-all"
            >
              {renderWaveIcon()}
            </button>
            <span className="text-[7px] font-bold text-gray-500 uppercase tracking-tighter">Wave</span>
          </div>
          <ControlKnob label="P Mod" min={0} max={7} value={patch.lfoPitchModSens} onChange={v => onChange({ lfoPitchModSens: v })} size={28} />
          <ControlKnob label="Speed" min={0} max={99} value={patch.lfoSpeed} onChange={v => onChange({ lfoSpeed: v })} size={28} />

          <ControlKnob label="Delay" min={0} max={99} value={patch.lfoDelay} onChange={v => onChange({ lfoDelay: v })} size={28} />
          <ControlKnob label="PMD" min={0} max={99} value={patch.lfoPitchModDepth} onChange={v => onChange({ lfoPitchModDepth: v })} size={28} />
          <ControlKnob label="AMD" min={0} max={99} value={patch.lfoAmpModDepth} onChange={v => onChange({ lfoAmpModDepth: v })} size={28} />

          {/* Row 3: Sync Switches */}
          <div className="flex flex-col items-center gap-1">
            <ToggleSwitch label="LFO Sync" active={patch.lfoSync} onChange={v => onChange({ lfoSync: v })} />
          </div>
          <div /> {/* Empty middle column */}
          <div className="flex flex-col items-center gap-1">
            <ToggleSwitch label="OSC Sync" active={patch.oscKeySync} onChange={v => onChange({ oscKeySync: v })} />
          </div>
        </div>
      </div>

      <div className="h-px bg-white/5 w-full my-1"></div>

      {/* Voice/Tone Section */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1 lg:gap-0.5">
          <ControlKnob label="Tune" min={-50} max={50} value={patch.fineTune} onChange={v => onChange({ fineTune: v })} displayValue={v => (v / 100).toFixed(2)} size={26} />
          <ControlKnob label="Cut" min={0} max={99} value={patch.cutoff} onChange={v => onChange({ cutoff: v })} size={26} />
          <ControlKnob label="Res" min={0} max={99} value={patch.resonance} onChange={v => onChange({ resonance: v })} size={26} />
        </div>

        <div className="grid grid-cols-3 gap-1 lg:gap-0.5 items-end">
          <ControlKnob label="Vol" min={0} max={99} value={patch.masterLevel} onChange={v => onChange({ masterLevel: v })} size={28} />
          <ControlKnob label="Trans" min={0} max={48} value={patch.transpose} onChange={v => onChange({ transpose: v })} displayValue={v => (v - 24).toString()} size={28} />
          <div className="flex flex-col items-center gap-1 pb-1">
            <ToggleSwitch label="Mono" active={patch.mono} onChange={v => onChange({ mono: v })} />
          </div>
        </div>
      </div>

      {/* Small label */}
      <div className="text-[7px] text-gray-600 font-bold uppercase tracking-widest text-center mt-auto opacity-50">
        TONE / LFO
      </div>
    </div>
  );
}