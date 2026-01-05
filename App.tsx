import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Patch, MidiDevice } from './types';
import { PRESETS } from './services/presets';
import { DX7Engine } from './services/engine';
import { SysExHandler } from './services/sysex';
import Keyboard from './components/Keyboard';
import OperatorPanel from './components/OperatorPanel';
import GlobalControlsPanel from './components/GlobalControlsPanel';
import AlgorithmMatrix from './components/AlgorithmMatrix';
import PitchEnvelopePanel from './components/PitchEnvelopePanel';
import ControlKnob from './components/ControlKnob';

const FileImporter = React.memo(({ onFilesSelected, inputRef }: { onFilesSelected: (patches: Patch[]) => void, inputRef: React.RefObject<HTMLInputElement> }) => {
  return (
    <input
      type="file"
      ref={inputRef}
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) {
          const r = new FileReader();
          r.onload = (ev) => {
            const patches = SysExHandler.parseFile(ev.target?.result as ArrayBuffer);
            if (patches.length > 0) {
              onFilesSelected(patches);
            }
          };
          r.readAsArrayBuffer(f);
        }
      }}
      accept=".syx"
      className="hidden"
    />
  );
});

const App: React.FC = () => {
  const [patch, setPatch] = useState<Patch>(PRESETS[0]);
  const [library, setLibrary] = useState<Patch[]>(PRESETS);
  const [currentPatchIndex, setCurrentPatchIndex] = useState(0);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [inputs, setInputs] = useState<MidiDevice[]>([]);
  const [outputs, setOutputs] = useState<MidiDevice[]>([]);
  const [selectedInputs, setSelectedInputs] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ddxx7_midi_inputs');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) return new Set(ids);
      } catch (e) { console.warn("Failed to parse MIDI inputs"); }
    }
    return new Set();
  });

  const [selectedOutput, setSelectedOutput] = useState<string>(() => {
    return localStorage.getItem('ddxx7_midi_output') || '';
  });

  // MIDI Persistence Savers
  useEffect(() => {
    localStorage.setItem('ddxx7_midi_inputs', JSON.stringify(Array.from(selectedInputs)));
  }, [selectedInputs]);

  useEffect(() => {
    localStorage.setItem('ddxx7_midi_output', selectedOutput);
  }, [selectedOutput]);

  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [activeViewVal, setActiveViewVal] = useState<'edit' | 'library'>('edit');
  const [isMidiPanelOpen, setIsMidiPanelOpen] = useState(false);
  const [manualVelocity, setManualVelocity] = useState<number>(100);
  const [isSendingToHW, setIsSendingToHW] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);

  const engineRef = useRef<DX7Engine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const [opLevels, setOpLevels] = useState<Float32Array>(new Float32Array(6));
  const [opStates, setOpStates] = useState<Int8Array>(new Int8Array(6).fill(4));

  useEffect(() => {
    engineRef.current = new DX7Engine(PRESETS[0]);
    engineRef.current.onOpLevels((levels, states) => {
      setOpLevels(levels);
      if (states) setOpStates(states);
    });
  }, []);

  useEffect(() => {
    fetch('./assets/patches/rom1a.syx')
      .then(res => res.arrayBuffer())
      .then(buffer => {
        const patches = SysExHandler.parseFile(buffer);
        if (patches.length > 0) {
          setLibrary(patches);
          setPatch(patches[0]);
          setCurrentPatchIndex(0);
          engineRef.current?.updatePatch(patches[0]);
        }
      })
      .catch(err => console.warn("rom1a.syx loading skipped"));
  }, []);

  const handlePanic = () => {
    engineRef.current?.panic();
    if (midiAccess && selectedOutput) {
      const out = midiAccess.outputs.get(selectedOutput);
      if (out) out.send([0xB0, 123, 0]);
    }
  };

  const handleSendToHW = useCallback((p: Patch) => {
    if (!midiAccess || !selectedOutput) return;
    const out = midiAccess.outputs.get(selectedOutput);
    if (out) {
      setIsSendingToHW(true);
      out.send(SysExHandler.createSingleVoiceDump(p));
      setTimeout(() => setIsSendingToHW(false), 120);
    }
  }, [midiAccess, selectedOutput]);

  const updatePatch = useCallback((changes: Partial<Patch>) => {
    setPatch(prev => {
      const next = { ...prev, ...changes };
      engineRef.current?.updatePatch(next);
      if (isAutoSyncEnabled) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 100) {
          handleSendToHW(next);
          lastSyncTimeRef.current = now;
        }
      }
      return next;
    });
  }, [isAutoSyncEnabled, handleSendToHW]);

  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess({ sysex: true }).then(access => {
        setMidiAccess(access);
        const update = () => {
          const ins: MidiDevice[] = []; const outs: MidiDevice[] = [];
          access.inputs.forEach(i => ins.push({ id: i.id, name: i.name || '?', manufacturer: i.manufacturer || '?' }));
          access.outputs.forEach(o => outs.push({ id: o.id, name: o.name || '?', manufacturer: o.manufacturer || '?' }));
          setInputs(ins); setOutputs(outs);
        };
        update(); access.onstatechange = update;
      }).catch(e => console.error("MIDI Init Error"));
    }
  }, []);

  useEffect(() => {
    if (!midiAccess) return;
    const onMsg = (e: any) => {
      const d = e.data;
      if (d[0] === 0xF0) {
        const patches = SysExHandler.parseFile(d.buffer);
        if (patches.length > 0) { updatePatch(patches[0]); }
        return;
      }

      const status = d[0] & 0xF0;
      const data1 = d[1];
      const data2 = d[2];

      if (status === 0x90 && data2 > 0) {
        engineRef.current?.noteOn(data1, data2 / 127);
      } else if (status === 0x80 || (status === 0x90 && data2 === 0)) {
        engineRef.current?.noteOff(data1);
      } else if (status === 0xB0) {
        // Control Change
        if (data1 === 1) { // Modulation Wheel
          engineRef.current?.setModWheel(data2 / 127);
        } else if (data1 === 64) { // Sustain Pedal
          engineRef.current?.setSustain(data2 >= 64);
        }
      } else if (status === 0xD0) { // Channel Aftertouch
        engineRef.current?.setAftertouch(data1 / 127);
      } else if (status === 0xE0) {
        // Pitch Bend (14-bit)
        const bendVal = (data2 << 7) + data1;
        const normalizedBend = (bendVal - 8192) / 8192;
        engineRef.current?.setPitchBend(normalizedBend);
      }
    };
    const handlers: MIDIInput[] = [];
    selectedInputs.forEach(id => {
      const i = midiAccess.inputs.get(id);
      if (i) { i.onmidimessage = onMsg; handlers.push(i); }
    });
    return () => handlers.forEach(h => h.onmidimessage = null);
  }, [midiAccess, selectedInputs, updatePatch]);

  const handlePatchSwitch = useCallback((idx: number) => {
    if (!library[idx]) return;
    const nextPatch = library[idx];
    setPatch(nextPatch);
    setCurrentPatchIndex(idx);
    engineRef.current?.updatePatch(nextPatch);
    if (isAutoSyncEnabled) handleSendToHW(nextPatch);
  }, [library, isAutoSyncEnabled, handleSendToHW]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Avoid conflict with input fields (e.g. typing patch name)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        handlePatchSwitch((currentPatchIndex - 1 + library.length) % library.length);
      } else if (e.key === 'ArrowRight') {
        handlePatchSwitch((currentPatchIndex + 1) % library.length);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePatchSwitch, currentPatchIndex, library.length]);

  const handleFilesSelected = useCallback((patches: Patch[]) => {
    setLibrary(patches);
    setPatch(patches[0]);
    setCurrentPatchIndex(0);
    engineRef.current?.updatePatch(patches[0]);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-300 font-inter overflow-hidden relative">
      <FileImporter
        inputRef={fileInputRef}
        onFilesSelected={handleFilesSelected}
      />

      {!isAudioUnlocked && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl">
          <div className="flex flex-col items-center gap-2 mb-12 animate-in fade-in zoom-in duration-500">
            <button
              onClick={async () => { await engineRef.current?.unlock(); setIsAudioUnlocked(true); }}
              className="w-40 h-40 border-2 border-dx7-teal/40 rounded-full flex items-center justify-center animate-glow active:scale-95 transition-transform group relative"
            >
              <div className="absolute inset-0 rounded-full border border-dx7-teal/20 scale-125 animate-ping opacity-20"></div>
              <div className="w-28 h-28 border border-dx7-teal/30 rounded-full flex flex-col items-center justify-center bg-black/80 shadow-[0_0_100px_rgba(0,212,193,0.3)] group-hover:shadow-[0_0_120px_rgba(0,212,193,0.5)] transition-all">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#00d4c1" strokeWidth="1.2" className="animate-pulse drop-shadow-[0_0_15px_rgba(0,212,193,0.8)]">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span className="text-[8px] font-orbitron text-dx7-teal font-bold mt-1 tracking-widest opacity-80 group-hover:opacity-100 leading-tight">
                  TAP TO<br />START
                </span>
              </div>
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-white font-orbitron text-3xl md:text-4xl font-bold tracking-[0.4em]">DDXX7</h2>
            <div className="h-px w-24 bg-dx7-teal/30 mx-auto"></div>
            <p className="text-dx7-teal font-mono text-[10px] uppercase tracking-[0.6em] opacity-60">Initialize FM Engine</p>
          </div>
        </div>
      )}

      <header className="bg-black px-3 flex justify-between items-center border-b border-[#222] shrink-0 z-50">
        <div className="flex items-center gap-6">
          <div className="text-2xl font-orbitron font-bold text-dx7-teal tracking-tighter">DDXX7</div>
          <div className="flex bg-[#111] rounded p-0.5 border border-[#333]">
            <button onClick={() => setActiveViewVal('edit')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeViewVal === 'edit' ? 'bg-black text-dx7-ink border border-dx7-teal shadow-[0_0_10px_rgba(0,212,193,0.15)]' : 'text-gray-500 hover:text-gray-300'}`}>Editor</button>
            <button onClick={() => setActiveViewVal('library')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${activeViewVal === 'library' ? 'bg-black text-dx7-ink border border-dx7-teal shadow-[0_0_10px_rgba(0,212,193,0.15)]' : 'text-gray-500 hover:text-gray-300'}`}>Library</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMidiPanelOpen(!isMidiPanelOpen)} className={`p-1.5 rounded-full border transition-all ${isMidiPanelOpen ? 'bg-dx7-teal/20 border-dx7-teal text-dx7-teal shadow-[0_0_12px_rgba(0,212,193,0.3)]' : 'border-[#333] text-gray-500 hover:text-dx7-teal'}`} title="MIDI Settings"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" /><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="7" cy="14" r="1.2" fill="currentColor" stroke="none" /><circle cx="17" cy="14" r="1.2" fill="currentColor" stroke="none" /></svg></button>
          <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-500 hover:text-dx7-teal transition-colors" title="Import SysEx/Patch File"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M8 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4" /></svg></button>
        </div>
      </header>

      {/* pb-32 on small, pb-48 on medium to match keyboard height, no pb on lg to fit screen */}
      <main className="flex-grow overflow-y-auto lg:overflow-hidden bg-[#0a0a0a] flex flex-col gap-6 md:gap-6 lg:gap-0 pt-4 md:pt-6 lg:pt-0 pb-40 md:pb-56 lg:pb-0 custom-scrollbar">
        {activeViewVal === 'edit' ? (
          <div className="w-full flex-grow flex flex-col lg:flex-row lg:pb-[209px] lg:overflow-hidden bg-[#0a0a0a]">
            {/* Left Column: Global Settings (Voice, Algorithm, Tone, Pitch Env) */}
            <div className="w-full lg:w-[55%] flex flex-col lg:overflow-y-auto custom-scrollbar lg:border-b border-white/10">
              <div className="bg-[#0f0f0f] border-b border-[#222] px-6 py-2 flex justify-between items-center lg:sticky lg:top-0 lg:z-20">
                <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.4em]">Patch info</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2 lg:gap-0">
                {/* Column 1: Voice & Algorithm */}
                <div className="flex flex-col bg-[#111]/40 p-2 lg:p-2 border-r border-b border-white/5">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-end px-1">
                      <div className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.2em]">Voice Info</div>
                      <div className="flex gap-1 bg-black/60 p-0.5 rounded border border-white/5">
                        <button onClick={() => handlePatchSwitch((currentPatchIndex - 1 + library.length) % library.length)} className="w-6 h-4 flex items-center justify-center bg-black hover:bg-[#222] text-dx7-teal border border-white/10 rounded-sm transition-all active:scale-95"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                        <button onClick={() => handlePatchSwitch((currentPatchIndex + 1) % library.length)} className="w-6 h-4 flex items-center justify-center bg-black hover:bg-[#222] text-dx7-teal border border-white/10 rounded-sm transition-all active:scale-95"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                      </div>
                    </div>
                    <div className={`lcd-screen w-full h-[110px] lg:h-[84px] p-3 rounded border-[3px] border-[#050505] relative flex flex-col justify-between overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] ${isSendingToHW ? 'brightness-125' : ''}`}>
                      <div className="flex justify-between items-center text-[8px] font-bold tracking-[0.1em]"><span className="opacity-40 uppercase tracking-widest text-[#7efab4]">DX7 SIM</span>{isAutoSyncEnabled && <div className="text-dx7-teal animate-pulse">SYNC</div>}</div>
                      <div className="flex-grow flex items-center">
                        <input className="bg-transparent text-lg lg:text-base font-mono w-full outline-none uppercase tracking-[0.15em] text-[#7efab4] font-bold" value={patch.name} onChange={e => updatePatch({ name: e.target.value.toUpperCase() })} />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono opacity-80 border-t border-[#7efab4]/10 pt-1"><span>ALG: {patch.algorithm.toString().padStart(2, '0')}</span><span>V: 12</span></div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2 lg:mt-0.5">
                    {/* Algorithm Graph Area */}
                    <div className="h-[260px] lg:h-[220px] bg-black/20 rounded-sm p-0.5 flex items-stretch">
                      <AlgorithmMatrix algorithmId={patch.algorithm} levels={opLevels} />
                    </div>
                  </div>
                  <div className="bg-black/40 p-2 lg:p-1 rounded-sm border border-white/5 flex justify-around items-center shadow-lg">
                    <ControlKnob label="Alg" min={1} max={32} value={patch.algorithm} onChange={v => updatePatch({ algorithm: v })} size={28} />
                    <ControlKnob label="Fback" min={0} max={7} value={patch.feedback} onChange={v => updatePatch({ feedback: v })} size={28} />
                  </div>
                </div>

                {/* Column 2: Tone & Pitch Stack */}
                <div className="flex flex-col border-r border-b border-white/5">
                  <GlobalControlsPanel patch={patch} onChange={updatePatch} />
                  <div className="h-px bg-white/5 w-full"></div>
                  <PitchEnvelopePanel patch={patch} onChange={c => updatePatch({ pitchEnvelope: { ...patch.pitchEnvelope, ...c } })} />
                </div>
              </div>
            </div>

            {/* Right Column: Operators 1-6 */}
            <div className="w-full flex flex-col border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0d0d0d] lg:h-full lg:overflow-y-auto custom-scrollbar">
              <div className="bg-[#0f0f0f] border-b border-[#222] px-6 py-2 flex justify-between items-center lg:sticky lg:top-0 lg:z-20">
                <h4 className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.4em]">Operator Configuration (1-6)</h4>
              </div>
              <div className="flex flex-col">
                {patch.operators.map((op, i) => (
                  <OperatorPanel key={i + 1} index={i + 1} params={op} level={opLevels[i]} envState={opStates[i]} onChange={p => {
                    const next = [...patch.operators]; next[i] = p; updatePatch({ operators: next });
                  }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 md:px-8 w-full h-full pb-20">
            <div className="bg-black/30 p-8 rounded-lg border border-[#333] h-full overflow-y-auto max-w-7xl mx-auto shadow-inner custom-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {library.map((p, idx) => (
                  <button key={idx} onClick={() => {
                    setPatch(p);
                    setCurrentPatchIndex(idx);
                    engineRef.current?.updatePatch(p);
                    if (isAutoSyncEnabled) handleSendToHW(p);
                    setActiveViewVal('edit');
                  }} className={`p-4 text-left font-mono text-[10px] rounded border transition-all active:scale-95 ${patch.name === p.name ? 'bg-black text-dx7-ink border-dx7-teal shadow-[0_0_20px_rgba(0,212,193,0.25)]' : 'bg-[#111] text-gray-500 border-white/5 hover:border-dx7-teal/40'}`}>
                    <div className="opacity-30 mb-1">{(idx + 1).toString().padStart(2, '0')}</div>
                    <div className="truncate font-bold text-[12px] tracking-tighter">{p.name || "UNNAMED"}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MIDI Configuration Panel */}
      <div className={`fixed bottom-0 left-0 right-0 bg-black border-t border-dx7-teal/30 z-[250] transition-all duration-300 ease-in-out overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.9)] ${isMidiPanelOpen ? 'h-[176px] md:h-[232px] opacity-100' : 'h-0 opacity-0'}`}>
        <div className="p-4 h-full flex flex-col max-w-4xl mx-auto gap-3">
          <div className="flex justify-between items-center">
            <h3 className="text-dx7-teal font-orbitron font-bold text-[10px] uppercase tracking-[0.4em]">MIDI CONFIGURATION</h3>
            <button onClick={() => setIsMidiPanelOpen(false)} className="text-gray-500 hover:text-white transition-colors text-[9px] font-bold uppercase tracking-widest">CLOSE</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">INPUTS</span>
              <select
                className="bg-[#111] border border-[#333] p-2 text-[11px] rounded text-dx7-teal outline-none focus:border-dx7-teal/50 transition-colors cursor-pointer"
                value={Array.from(selectedInputs)[0] || ""}
                onChange={(e) => setSelectedInputs(e.target.value ? new Set([e.target.value]) : new Set())}
              >
                <option value="">No MIDI input selected</option>
                {inputs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">TRANSMIT TARGET</span>
              <select
                className="bg-[#111] border border-[#333] p-2 text-[11px] rounded text-dx7-teal outline-none focus:border-dx7-teal/50 transition-colors cursor-pointer"
                value={selectedOutput}
                onChange={(e) => setSelectedOutput(e.target.value)}
              >
                <option value="">No MIDI output selected</option>
                {outputs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-white/5 border border-white/10 rounded items-center mt-auto">
            <button onClick={handlePanic} className="bg-red-950/40 text-red-500 border border-red-500/40 px-4 py-1.5 text-[9px] font-bold rounded uppercase tracking-widest hover:bg-red-900/60 transition-colors">PANIC</button>
            <div className="flex-grow"></div>
            <button onClick={() => handleSendToHW(patch)} disabled={!selectedOutput} className={`px-5 py-1.5 bg-dx7-teal/20 text-dx7-teal border border-dx7-teal/30 text-[9px] font-bold rounded transition-all active:scale-95 ${!selectedOutput ? 'opacity-20 cursor-not-allowed' : 'hover:bg-dx7-teal/40'}`}>{isSendingToHW ? 'SENDING...' : 'SEND VOICE'}</button>
          </div>
        </div>
      </div>

      {isAudioUnlocked && (
        <Keyboard velocity={manualVelocity} onVelocityChange={setManualVelocity} onNoteOn={n => engineRef.current?.noteOn(n, manualVelocity / 127)} onNoteOff={n => engineRef.current?.noteOff(n)} />
      )}

      <style>{`
        @keyframes glow { 
          0%, 100% { box-shadow: 0 0 25px rgba(0, 212, 193, 0.2); border-color: rgba(0, 212, 193, 0.4); } 
          50% { box-shadow: 0 0 60px rgba(0, 212, 193, 0.6); border-color: rgba(0, 212, 193, 0.9); } 
        }
        .animate-glow { animation: glow 2.5s infinite ease-in-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;