
import React, { useState, useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  size?: number;
  displayValue?: string | number;
}

const ControlKnob: React.FC<KnobProps> = ({ label, value, min, max, onChange, size = 44, displayValue }) => {
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
    const sensitivity = 0.5;
    let newVal = startVal.current + (deltaY * (range / 100)) * sensitivity;
    newVal = Math.max(min, Math.min(max, Math.round(newVal)));
    if (newVal !== value) onChange(newVal);
  };

  const handlePointerUp = () => setIsDragging(false);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <div className="flex flex-col items-center gap-1 group relative">
      {/* Popover - Now closer to the knob and with a backdrop */}
      {isDragging && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#050a09]/95 border border-dx7-teal/50 text-dx7-ink font-mono text-[10px] px-2 py-0.5 rounded shadow-lg z-50 animate-in fade-in zoom-in duration-75 whitespace-nowrap">
          {displayValue ?? value}
        </div>
      )}
      
      <div 
        className="relative cursor-ns-resize touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: size, height: size }}
      >
        {/* Knob Body */}
        <div className="w-full h-full rounded-full bg-[#1a1a1a] border-2 border-[#333] shadow-inner flex items-center justify-center">
          <div 
            className="w-[85%] h-[85%] rounded-full bg-gradient-to-br from-[#444] to-[#222] shadow-md relative"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            {/* Pointer Indicator */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-dx7-teal rounded-full shadow-[0_0_5px_rgba(0,212,193,0.5)]"></div>
          </div>
        </div>
      </div>
      <span className="text-[8px] text-gray-500 uppercase font-bold tracking-tighter text-center leading-none">{label}</span>
    </div>
  );
};

export default ControlKnob;
