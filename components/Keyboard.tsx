import React, { useState, useEffect, useCallback, useRef } from 'react';

interface KeyboardProps {
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  velocity: number;
  onVelocityChange: (vel: number) => void;
}

const KEY_TO_NOTE: Record<string, number> = {
  'z': 0, 's': 1, 'x': 2, 'd': 3, 'c': 4, 'v': 5, 'g': 6, 'b': 7, 'h': 8, 'n': 9, 'j': 10, 'm': 11,
  ',': 12, 'l': 13, '.': 14, ';': 15, '/': 16,
  'q': 12, '2': 13, 'w': 14, '3': 15, 'e': 16, 'r': 17, '5': 18, 't': 19, '6': 20,
  'y': 21, '7': 22, 'u': 23, 'i': 24, '9': 25, 'o': 26, '0': 27, 'p': 28
};

const Keyboard: React.FC<KeyboardProps> = ({ onNoteOn, onNoteOff, velocity, onVelocityChange }) => {
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [octave, setOctave] = useState(4);
  const [isExpanded, setIsExpanded] = useState(true);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
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

  // Pointer Event Handlers for Keys
  const onKeyPointerDown = (e: React.PointerEvent, n: number) => {
    e.preventDefault();
    handleNoteOn(n);
  };

  const onKeyPointerEnter = (e: React.PointerEvent, n: number) => {
    e.preventDefault();
    // Play note if mouse button is held (buttons === 1) or if it's a touch input
    if (e.buttons === 1 || e.pointerType === 'touch') {
      handleNoteOn(n);
    }
  };

  const onKeyPointerLeave = (e: React.PointerEvent, n: number) => {
    e.preventDefault();
    handleNoteOff(n);
  };

  const onKeyPointerUp = (e: React.PointerEvent, n: number) => {
    e.preventDefault();
    handleNoteOff(n);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const noteOffset = KEY_TO_NOTE[e.key.toLowerCase()];
      if (noteOffset !== undefined) handleNoteOn(noteOffset);
      if (e.key === '[') setOctave(prev => Math.max(0, prev - 1));
      if (e.key === ']') setOctave(prev => Math.min(8, prev + 1));
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const noteOffset = KEY_TO_NOTE[e.key.toLowerCase()];
      if (noteOffset !== undefined) handleNoteOff(noteOffset);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [handleNoteOn, handleNoteOff]);

  const keyCount = isMobile ? 18 : 28;
  const keys = Array.from({ length: keyCount }, (_, i) => i);

  const isBlackKey = (n: number) => [1, 3, 6, 8, 10, 13, 15, 18, 20, 22, 25, 27].includes(n % 12);
  const getNoteName = (n: number) => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-[#333] select-none z-[200] pb-2 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-[#222]">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsExpanded(!isExpanded)} className={`w-7 h-7 flex items-center justify-center rounded border border-[#333] transition-all hover:bg-white/5 ${isExpanded ? 'text-dx7-teal border-dx7-teal/50' : 'text-gray-500'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div className="flex items-center bg-black rounded border border-[#222] overflow-hidden">
            <button onClick={() => setOctave(prev => Math.max(0, prev - 1))} className="px-2 py-0.5 hover:bg-white/5 text-xs border-r border-[#222] text-gray-400 font-bold">-</button>
            <div className="px-3 py-0.5 text-[9px] font-mono text-dx7-teal min-w-[60px] text-center uppercase tracking-widest font-bold">C{octave}-C{octave + 2}</div>
            <button onClick={() => setOctave(prev => Math.min(8, prev + 1))} className="px-2 py-0.5 hover:bg-white/5 text-xs text-gray-400 font-bold">+</button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-grow max-w-[320px] ml-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 shrink-0">
            <rect x="2" y="3" width="20" height="18" rx="2" ry="2" />
            <line x1="7" y1="3" x2="7" y2="15" />
            <line x1="12" y1="3" x2="12" y2="15" />
            <line x1="17" y1="3" x2="17" y2="15" />
            <line x1="2" y1="15" x2="22" y2="15" />
          </svg>
          <div className="flex-grow flex items-center gap-2 bg-black/50 px-2 py-0.5 rounded-full border border-[#222] h-7">
            <input type="range" min="1" max="127" value={velocity} onChange={(e) => onVelocityChange(parseInt(e.target.value))} className="dx7-slider" />
            <span className="text-[10px] font-mono text-dx7-teal w-6 font-bold text-right shrink-0">{velocity}</span>
          </div>
        </div>
      </div>

      {/* Keyboard Container with touch-action: none to prevent scrolling */}
      <div
        className={`relative w-full flex items-stretch overflow-hidden transition-[height,opacity] duration-300 ${isExpanded ? 'h-32 md:h-48 lg:h-36 opacity-100' : 'h-0 opacity-0'}`}
        style={{ touchAction: 'none' }}
      >
        {keys.map((n) => {
          if (isBlackKey(n)) return null;
          const active = activeNotes.has(n + (octave * 12));
          return (
            <div
              key={n}
              className={`flex-grow border-r border-black/10 relative cursor-pointer ${active ? 'bg-dx7-teal' : 'bg-white hover:bg-gray-100'}`}
              onPointerDown={(e) => onKeyPointerDown(e, n)}
              onPointerEnter={(e) => onKeyPointerEnter(e, n)}
              onPointerLeave={(e) => onKeyPointerLeave(e, n)}
              onPointerUp={(e) => onKeyPointerUp(e, n)}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold ${active ? 'text-black/40' : 'text-gray-300'}`}>{getNoteName(n)}</span>
            </div>
          );
        })}
        <div className="absolute inset-0 pointer-events-none flex items-stretch">
          {keys.map((n) => {
            if (!isBlackKey(n)) return <div key={n} className="flex-grow" />;
            const active = activeNotes.has(n + (octave * 12));
            return (
              <div key={n} className="relative z-10" style={{ width: '0%', flexBasis: '0%' }}>
                <div
                  className={`absolute top-0 -left-[14px] md:-left-[18px] w-[28px] md:w-[36px] h-[60%] border border-black rounded-b shadow-lg pointer-events-auto transition-all ${active ? 'bg-dx7-teal' : 'bg-gradient-to-b from-[#111] to-[#333]'}`}
                  onPointerDown={(e) => { e.stopPropagation(); onKeyPointerDown(e, n); }}
                  onPointerEnter={(e) => { e.stopPropagation(); onKeyPointerEnter(e, n); }}
                  onPointerLeave={(e) => { e.stopPropagation(); onKeyPointerLeave(e, n); }}
                  onPointerUp={(e) => { e.stopPropagation(); onKeyPointerUp(e, n); }}
                  onContextMenu={(e) => e.preventDefault()}
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