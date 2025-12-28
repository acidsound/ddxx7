
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Patch, MidiDevice } from './types';
import { PRESETS } from './services/presets';
import { DX7Engine } from './services/engine';
import { SysExHandler } from './services/sysex';
import Keyboard from './components/Keyboard';
import OperatorPanel from './components/OperatorPanel';
import ControlKnob from './components/ControlKnob';
import AlgorithmMatrix from './components/AlgorithmMatrix';

const App: React.FC = () => {
  const [patch, setPatch] = useState<Patch>(PRESETS[0]);
  const [library, setLibrary] = useState<Patch[]>([]);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<MidiDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [activeView, setActiveView] = useState<'edit' | 'library'>('edit');
  const [manualVelocity, setManualVelocity] = useState<number>(100);

  const engineRef = useRef<DX7Engine>(new DX7Engine(PRESETS[0]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPatchIndex = useMemo(() => {
    return library.findIndex(p => p.name === patch.name);
  }, [library, patch.name]);

  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: true })
        .then(access => {
          setMidiAccess(access);
          const update = () => {
            const ins: MidiDevice[] = [];
            access.inputs.forEach(i => ins.push({ id: i.id, name: i.name || '?', manufacturer: i.manufacturer || '?' }));
            setInputs(ins);
          };
          update();
          access.onstatechange = update;
        })
        .catch(() => console.error("MIDI Access Denied"));
    }

    const loadDefaultRom = async () => {
        try {
            const response = await fetch('assets/patches/rom1a.syx');
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const patches = SysExHandler.parseFile(buffer);
                if (patches.length > 0) {
                    setLibrary(patches);
                    setPatch(patches[0]);
                    engineRef.current.updatePatch(patches[0]);
                }
            }
        } catch (e) {
            console.warn("Failed to fetch default ROM", e);
        }
    };
    loadDefaultRom();
  }, []);

  useEffect(() => {
    if (!midiAccess || !selectedInput) return;
    const input = midiAccess.inputs.get(selectedInput);
    if (!input) return;
    input.onmidimessage = (e: any) => {
      const [s, d1, d2] = e.data;
      const status = s & 0xF0;
      if (status === 0x90 && d2 > 0) engineRef.current.noteOn(d1, d2 / 127);
      else if (status === 0x80 || (status === 0x90 && d2 === 0)) engineRef.current.noteOff(d1);
    };
    return () => { input.onmidimessage = null; };
  }, [midiAccess, selectedInput]);

  const updatePatch = (changes: Partial<Patch>) => {
    const next = { ...patch, ...changes };
    setPatch(next);
    engineRef.current.updatePatch(next);
  };

  const handlePrevPatch = () => {
    if (library.length === 0) return;
    const nextIdx = (currentPatchIndex - 1 + library.length) % library.length;
    const nextPatch = library[nextIdx];
    setPatch(nextPatch);
    engineRef.current.updatePatch(nextPatch);
  };

  const handleNextPatch = () => {
    if (library.length === 0) return;
    const nextIdx = (currentPatchIndex + 1) % library.length;
    const nextPatch = library[nextIdx];
    setPatch(nextPatch);
    engineRef.current.updatePatch(nextPatch);
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as ArrayBuffer;
      const patches = SysExHandler.parseFile(result);
      if (patches.length > 0) {
          setLibrary(patches);
          setPatch(patches[0]);
          engineRef.current.updatePatch(patches[0]);
          setActiveView('library');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-300 font-inter overflow-hidden relative">
      <input type="file" ref={fileInputRef} onChange={handleFileLoad} accept=".syx" className="hidden" />

      {/* Header Bar */}
      <header className="bg-black p-3 flex justify-between items-center border-b border-[#222] shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="text-xl font-orbitron font-bold text-dx7-teal tracking-tighter">
            <span className="text-white italic text-lg">DX7</span>
          </div>
          <div className="flex bg-[#111] rounded p-0.5 border border-[#333]">
             <button 
                onClick={() => setActiveView('edit')} 
                className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${activeView === 'edit' ? 'bg-black text-dx7-ink border border-dx7-teal shadow-[0_0_10px_rgba(0,212,193,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
             >
               Editor
             </button>
             <button 
                onClick={() => setActiveView('library')} 
                className={`px-3 py-1 rounded text-[9px] font-bold uppercase transition-all ${activeView === 'library' ? 'bg-black text-dx7-ink border border-dx7-teal shadow-[0_0_10px_rgba(0,212,193,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
             >
               Library
             </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select value={selectedInput} onChange={e => setSelectedInput(e.target.value)} className="bg-black text-[9px] p-1.5 border border-[#333] text-dx7-teal rounded outline-none w-32 md:w-48 font-mono">
            <option value="">None</option>
            {inputs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button onClick={() => fileInputRef.current?.click()} className="bg-dx7-bg-teal/10 hover:bg-dx7-bg-teal/20 text-dx7-teal text-[9px] px-3 py-1.5 rounded uppercase font-bold border border-dx7-teal/20 transition-colors">Import</button>
        </div>
      </header>

      {/* Main Interface */}
      <main 
        className="flex-grow overflow-y-auto bg-[#1a1a1a] flex flex-col gap-6 pt-3 md:pt-6 pb-48 md:pb-64 custom-scrollbar relative"
        style={{ touchAction: 'pan-y' }}
      >
        {activeView === 'edit' ? (
          <div className="w-full flex flex-col gap-8">
            {/* Top Dashboard Section */}
            <div className="px-3 md:px-6">
              <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* LCD Screen Container */}
                <div className="md:col-span-5 flex flex-col gap-2">
                  <div className="flex justify-between items-end pl-1 pr-1">
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Display Unit</div>
                    
                    {/* Integrated Flat Navigation Buttons */}
                    {library.length > 0 && (
                      <div className="flex gap-1.5 bg-[#111] p-0.5 rounded border border-[#333]">
                        <button 
                          onClick={handlePrevPatch}
                          className="w-6 h-5 flex items-center justify-center bg-black hover:bg-[#222] text-dx7-teal border border-[#333] rounded-sm active:translate-y-px transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                          </svg>
                        </button>
                        <button 
                          onClick={handleNextPatch}
                          className="w-6 h-5 flex items-center justify-center bg-black hover:bg-[#222] text-dx7-teal border border-[#333] rounded-sm active:translate-y-px transition-all"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="lcd-screen w-full aspect-[2.4/1] md:aspect-[2.2/1] p-6 rounded-sm border-[6px] border-[#080808] shadow-[0_10px_30px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(0,0,0,0.8)] relative flex flex-col justify-between overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                      
                      {/* Patch Indicator / Index */}
                      <div className="flex justify-between items-center text-[10px] font-bold tracking-[0.2em] mb-2">
                        <span className="opacity-40 uppercase">INTERNAL VOICE</span>
                        {library.length > 0 && (
                          <div className="bg-[#7efab4]/10 px-2 py-0.5 border border-[#7efab4]/30 text-xs font-mono flex items-center gap-2">
                            <span className="text-[#7efab4]">{currentPatchIndex + 1}</span>
                            <span className="opacity-30">/</span>
                            <span className="opacity-60">{library.length}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-grow flex items-center">
                        <input 
                          className="bg-transparent text-3xl md:text-4xl font-mono w-full outline-none uppercase tracking-widest text-[#7efab4] selection:bg-dx7-teal/30" 
                          value={patch.name} 
                          onChange={e => updatePatch({name: e.target.value.toUpperCase()})}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-mono opacity-80 mt-4 border-t border-[#7efab4]/20 pt-2">
                        <div className="flex gap-4">
                          <span>ALG: <span className="font-bold">{patch.algorithm}</span></span>
                          <span>POLY: 12</span>
                        </div>
                        <div>FB: {patch.feedback}</div>
                      </div>
                  </div>
                </div>

                {/* Algorithm Map */}
                <div className="md:col-span-2 flex flex-col gap-2 h-full">
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest pl-1">Matrix</div>
                    <div className="flex-grow flex items-stretch">
                      <AlgorithmMatrix algorithmId={patch.algorithm} />
                    </div>
                </div>
                
                {/* Global Strip */}
                <div className="md:col-span-5 flex flex-col gap-2">
                  <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest pl-1">Global Parameters</div>
                  <div className="bg-[#121212] p-4 rounded border border-[#333] flex flex-wrap gap-4 md:gap-6 justify-between md:justify-start items-center h-full">
                      <ControlKnob label="Algo" min={1} max={32} value={patch.algorithm} onChange={v => updatePatch({algorithm: v})} />
                      <ControlKnob label="Fback" min={0} max={7} value={patch.feedback} onChange={v => updatePatch({feedback: v})} />
                      <div className="w-px bg-[#2a2a2a] self-stretch hidden md:block"></div>
                      <ControlKnob label="LFO Spd" min={0} max={99} value={patch.lfoSpeed} onChange={v => updatePatch({lfoSpeed: v})} />
                      <ControlKnob label="Delay" min={0} max={99} value={patch.lfoDelay} onChange={v => updatePatch({lfoDelay: v})} />
                      <ControlKnob label="PMD" min={0} max={99} value={patch.lfoPitchModDepth} onChange={v => updatePatch({lfoPitchModDepth: v})} />
                      <div className="w-px bg-[#2a2a2a] self-stretch hidden md:block"></div>
                      <ControlKnob label="Trnsp" min={0} max={48} value={patch.transpose} onChange={v => updatePatch({transpose: v})} displayValue={patch.transpose - 24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Operator Stack - Edge to Edge */}
            <div className="flex flex-col gap-0 border-t border-[#333]">
              <div className="flex items-center text-[9px] font-bold text-gray-600 px-4 uppercase tracking-[0.25em] py-2 bg-[#0d0d0d]">
                 <span className="w-[60px] text-center">OP UNIT</span>
                 <span className="flex-grow pl-10">MODIFIER PANEL</span>
              </div>
              <div className="flex flex-col">
                {patch.operators.slice().reverse().map((_, i) => (
                  <OperatorPanel 
                      key={6-i} 
                      index={6-i} 
                      params={patch.operators[5-i]} 
                      onChange={p => {
                          const nextOps = [...patch.operators];
                          nextOps[5-i] = p;
                          updatePatch({operators: nextOps});
                      }} 
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Library View */
          <div className="px-3 md:px-6 w-full">
            <div className="bg-black/30 p-4 md:p-8 rounded-lg border border-[#333] h-full overflow-y-auto max-w-6xl mx-auto w-full">
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {library.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setPatch(p); engineRef.current.updatePatch(p); setActiveView('edit'); }}
                      className={`p-4 text-left font-mono text-[10px] rounded border transition-all duration-75 active:scale-95 ${patch.name === p.name ? 'bg-black text-dx7-ink border-dx7-teal shadow-[0_0_15px_rgba(0,212,193,0.2)]' : 'bg-[#111] text-gray-500 border-white/5 hover:border-dx7-teal/30 hover:bg-[#181818]'}`}
                    >
                      <div className="opacity-40 mb-1">{(idx+1).toString().padStart(2,'0')}</div>
                      <div className="truncate font-bold tracking-tighter text-xs">{p.name || "UNNAMED"}</div>
                    </button>
                  ))}
               </div>
            </div>
          </div>
        )}
      </main>

      <Keyboard 
        velocity={manualVelocity}
        onVelocityChange={setManualVelocity}
        onNoteOn={n => engineRef.current.noteOn(n, manualVelocity / 127)} 
        onNoteOff={n => engineRef.current.noteOff(n)} 
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
        
        input[type="range"].appearance-slider-vertical {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type="range"].appearance-slider-vertical::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 0; width: 0;
        }
      `}</style>
    </div>
  );
};

export default App;
