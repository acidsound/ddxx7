
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface KeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  velocity: number;
  onVelocityChange: (vel: number) => void;
}

// PC Keyboard to MIDI Note Offset Mapping
const KEY_TO_NOTE: Record<string, number> = {
  // Lower octave (Home row)
  'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11, 
  ',': 12, 'l': 13, '.': 14, ';': 15, '/': 16, 
  // Upper octave (Top row) - Mapping unique keys for higher notes to avoid duplicates
  'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16, 'r': 17, '5': 18, 't': 19, '6': 20, 
  'y': 21, '7': 22, 'u': 23, 'i': 24, '9': 25, 'o': 26, '0': 27, 'p': 28
};

const Keyboard: React.FC<KeyboardProps> = ({ onNoteOn, onNoteOff, velocity, onVelocityChange }) => {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [octave, setOctave] = useState(3);
  const [isExpanded, setIsExpanded] = useState(true);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNoteOn = useCallback((note: number) => {
    const finalNote = note + (octave * 12);
    if (activeNotesRef.current.has(finalNote)) return;
    activeNotesRef.current.add(finalNote);
    setActiveNotes(new Set(activeNotesRef.current));
    onNoteOn(finalNote);
  }, [onNoteOn, octave]);

  const handleNoteOff = useCallback((note: number) => {
    const finalNote = note + (octave * 12);
    if (!activeNotesRef.current.has(finalNote)) return;
    activeNotesRef.current.delete(finalNote);
    setActiveNotes(new Set(activeNotesRef.current));
    onNoteOff(finalNote);
  }, [onNoteOff, octave]);

  // Musical Typing Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const noteOffset = KEY_TO_NOTE[e.key.toLowerCase()];
      if (noteOffset !== undefined) {
        handleNoteOn(noteOffset);
      }
      
      // Octave switching via Z/X
      if (e.key.toLowerCase() === '[') setOctave(prev => Math.max(0, prev - 1));
      if (e.key.toLowerCase() === ']') setOctave(prev => Math.min(8, prev + 1));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const noteOffset = KEY_TO_NOTE[e.key.toLowerCase()];
      if (noteOffset !== undefined) {
        handleNoteOff(noteOffset);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleNoteOn, handleNoteOff]);

  const keyCount = isMobile ? 18 : 31;
  const keys = Array.from({ length: keyCount }, (_, i) => i);

  const isBlackKey = (n: number) => [1, 3, 6, 8, 10, 13, 15, 18, 20, 22, 25, 27, 30].includes(n % 12);
  const getNoteName = (n: number) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[n % 12];
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-[#333] select-none z-50 pb-safe shadow-[0_-15px_40px_rgba(0,0,0,0.7)] flex flex-col transition-all duration-300 ease-in-out">
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#222] shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-8 h-8 flex items-center justify-center rounded border border-[#333] transition-all hover:bg-white/5 active:scale-95 ${isExpanded ? 'text-dx7-teal border-dx7-teal/50' : 'text-gray-500'}`}
            title={isExpanded ? "Collapse Keyboard" : "Expand Keyboard"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest hidden md:inline">Octave [Z/X]</span>
            <div className="flex items-center bg-black rounded border border-[#222] overflow-hidden">
              <button 
                onClick={() => setOctave(prev => Math.max(0, prev - 1))}
                className="px-3 py-1 hover:bg-white/5 active:bg-dx7-teal/20 text-sm border-r border-[#222] text-gray-400 font-bold transition-colors"
              >-</button>
              <div className="px-4 py-1 text-[10px] font-mono text-dx7-teal min-w-[70px] text-center uppercase tracking-widest font-bold">
                C{octave}-C{octave+2}
              </div>
              <button 
                onClick={() => setOctave(prev => Math.min(8, prev + 1))}
                className="px-3 py-1 hover:bg-white/5 active:bg-dx7-teal/20 text-sm text-gray-400 font-bold transition-colors"
              >+</button>
            </div>
          </div>
        </div>

        {/* Velocity Slider */}
        <div className="flex items-center gap-3 flex-grow max-w-[400px] mx-4">
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Velocity</span>
          <div className="flex-grow flex items-center gap-3 bg-black/50 px-3 py-1 rounded-full border border-[#222]">
            <input 
              type="range" 
              min="1" max="127" 
              value={velocity} 
              onChange={(e) => onVelocityChange(parseInt(e.target.value))}
              className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer accent-dx7-teal"
            />
            <span className="text-[11px] font-mono text-dx7-teal w-8 font-bold text-right">{velocity}</span>
          </div>
        </div>
        
        <div className="hidden lg:block text-[8px] text-gray-600 font-bold uppercase tracking-widest">
           Musical Typing Active
        </div>
      </div>

      {/* Keyboard Area */}
      <div className={`relative w-full flex items-stretch overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'h-40 md:h-56 opacity-100' : 'h-0 opacity-0'}`}>
        {keys.map((n) => {
          const black = isBlackKey(n);
          const active = activeNotes.has(n + (octave * 12));
          if (black) return null;

          return (
            <div
              key={n}
              className={`flex-grow border-r border-black/10 relative group cursor-pointer transition-all duration-75 ${active ? 'bg-dx7-teal shadow-[inset_0_0_20px_rgba(255,255,255,0.4)]' : 'bg-white hover:bg-gray-100 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.05)]'}`}
              onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); handleNoteOn(n); }}
              onPointerUp={() => handleNoteOff(n)}
              onPointerEnter={(e) => { if (e.buttons === 1) handleNoteOn(n); }}
              onPointerLeave={() => handleNoteOff(n)}
            >
              <span className={`absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold pointer-events-none transition-colors ${active ? 'text-black/40' : 'text-gray-300'}`}>
                {getNoteName(n)}
              </span>
            </div>
          );
        })}

        {/* Black Keys Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-stretch px-0">
          {keys.map((n) => {
            const black = isBlackKey(n);
            if (!black) return <div key={n} className="flex-grow" />;
            
            const active = activeNotes.has(n + (octave * 12));
            return (
              <div
                key={n}
                className="relative z-10"
                style={{ width: '0%', flexBasis: '0%' }}
              >
                <div
                  className={`absolute top-0 -left-[14px] md:-left-[20px] w-[28px] md:w-[40px] h-[62%] border border-black rounded-b shadow-[0_4px_10px_rgba(0,0,0,0.5)] pointer-events-auto transition-all duration-75 ${active ? 'bg-dx7-teal shadow-[0_0_20px_rgba(255,255,255,0.8),inset_0_0_10px_rgba(255,255,255,0.3)]' : 'bg-gradient-to-b from-[#111] to-[#333] hover:from-[#222] hover:to-[#444]'}`}
                  onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); handleNoteOn(n); e.stopPropagation(); }}
                  onPointerUp={() => handleNoteOff(n)}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Keyboard;
