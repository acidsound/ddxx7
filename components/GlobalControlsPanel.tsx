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
    <div className="bg-[#2a241c] p-4 rounded border border-[#3d3326] flex flex-col gap-6 shadow-xl w-full h-full min-h-[400px]">
      {/* LFO Modulation Section */}
      <div className="flex flex-col gap-6">
        {/* Unified 3x2 Grid for Vertical Alignment */}
        <div className="grid grid-cols-3 gap-y-6 gap-x-2 items-start justify-items-center">
          {/* Row 1: Wave, P Mod Sens, Speed */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
            <button 
              onClick={() => onChange({ lfoWaveform: (patch.lfoWaveform + 1) % LFO_WAVEFORMS.length })}
              className="w-12 h-10 bg-black rounded border border-white/5 flex items-center justify-center hover:border-dx7-teal/40 transition-all shadow-inner"
            >
              {renderWaveIcon()}
            </button>
            <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-widest">Wave</span>
          </div>
          <ControlKnob label="P Mod Sens" min={0} max={7} value={patch.lfoPitchModSens} onChange={v => onChange({ lfoPitchModSens: v })} size={34} />
          <ControlKnob label="Speed" min={0} max={99} value={patch.lfoSpeed} onChange={v => onChange({ lfoSpeed: v })} size={34} />

          {/* Row 2: Delay, PMD, AMD */}
          <ControlKnob label="Delay" min={0} max={99} value={patch.lfoDelay} onChange={v => onChange({ lfoDelay: v })} size={34} />
          <ControlKnob label="PMD" min={0} max={99} value={patch.lfoPitchModDepth} onChange={v => onChange({ lfoPitchModDepth: v })} size={34} />
          <ControlKnob label="AMD" min={0} max={99} value={patch.lfoAmpModDepth} onChange={v => onChange({ lfoAmpModDepth: v })} size={34} />
        </div>

        {/* Row 3: LFO Sync, OSC Sync (2 Toggles) */}
        <div className="flex justify-center gap-8 pt-2">
          <ToggleSwitch label="LFO Key Sync" active={patch.lfoSync} onChange={v => onChange({ lfoSync: v })} />
          <ToggleSwitch label="OSC Key Sync" active={patch.oscKeySync} onChange={v => onChange({ oscKeySync: v })} />
        </div>
      </div>

      <div className="h-px bg-white/5 w-full"></div>

      {/* Voice/Tone Section */}
      <div className="flex flex-col gap-4">
        {/* Row 4: Tune, Cutoff, Reso (3 Knobs) */}
        <div className="grid grid-cols-3 gap-2">
          <ControlKnob label="Tune" min={-50} max={50} value={patch.fineTune} onChange={v => onChange({ fineTune: v })} displayValue={v => (v / 100).toFixed(2)} size={32} />
          <ControlKnob label="Cutoff" min={0} max={99} value={patch.cutoff} onChange={v => onChange({ cutoff: v })} size={32} />
          <ControlKnob label="Reso" min={0} max={99} value={patch.resonance} onChange={v => onChange({ resonance: v })} size={32} />
        </div>

        {/* Row 5: Level, Transpose (2 Knobs) */}
        <div className="flex justify-center gap-12">
          <ControlKnob label="Level" min={0} max={99} value={patch.masterLevel} onChange={v => onChange({ masterLevel: v })} size={36} />
          <ControlKnob label="Transpose" min={0} max={48} value={patch.transpose} onChange={v => onChange({ transpose: v })} displayValue={v => (v - 24).toString()} size={36} />
        </div>

        {/* Row 6: Monophonic (1 Toggle) */}
        <div className="flex justify-center py-2 bg-black/10 rounded-sm border border-white/5">
           <ToggleSwitch label="Monophonic" active={patch.mono} onChange={v => onChange({ mono: v })} />
        </div>
      </div>
      
      {/* Decorative footer label */}
      <div className="flex justify-center items-center gap-3 text-[7px] text-gray-500 font-bold uppercase tracking-[0.2em] border-t border-white/5 pt-3 mt-auto">
         <div className="flex gap-1">
            <div className="w-0.5 h-0.5 bg-dx7-teal/40 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-dx7-teal/40 rounded-full"></div>
         </div>
         Global Tone Generator
         <div className="flex gap-1">
            <div className="w-0.5 h-0.5 bg-dx7-teal/40 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-dx7-teal/40 rounded-full"></div>
         </div>
      </div>
    </div>
  );
}