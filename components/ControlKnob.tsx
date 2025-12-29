import React, { useState, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  size?: number;
  displayValue?: string | number | ((val: number) => string | number);
}

export default function ControlKnob({ label, value, min, max, onChange, size = 38, displayValue }: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const sensitivity = 0.4;
    let newVal = startVal.current + (deltaY * (range / 100)) * sensitivity;
    newVal = Math.max(min, Math.min(max, Math.round(newVal)));
    if (newVal !== value) onChange(newVal);
  };

  const handlePointerUp = () => setIsDragging(false);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const formattedValue = typeof displayValue === 'function' 
    ? displayValue(value) 
    : displayValue ?? value;

  return (
    <div className="flex flex-col items-center gap-1 group relative">
      {isDragging && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#050a09]/95 border border-dx7-teal/50 text-dx7-ink font-mono text-[9px] px-1.5 py-0.5 rounded shadow-lg z-50 animate-in fade-in zoom-in duration-75 whitespace-nowrap">
          {formattedValue}
        </div>
      )}
      <div 
        className="relative cursor-ns-resize touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: size, height: size }}
      >
        <div className="w-full h-full rounded-full bg-[#111] border border-[#333] shadow-inner flex items-center justify-center overflow-hidden">
          <div 
            className="w-[90%] h-[90%] rounded-full bg-gradient-to-br from-[#333] to-[#111] shadow-md relative"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-gray-300 rounded-full opacity-60"></div>
          </div>
        </div>
      </div>
      <span className="text-[8px] md:text-[9px] text-gray-400 uppercase font-bold tracking-tight text-center leading-tight max-w-[50px] line-clamp-2 min-h-[1.5em]">{label}</span>
    </div>
  );
}