
import React, { useState, useRef, useEffect } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

const ControlSlider: React.FC<SliderProps> = ({ label, value, min, max, onChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const calculateValue = (clientY: number) => {
    if (!trackRef.current) return value;
    const rect = trackRef.current.getBoundingClientRect();
    const height = rect.height;
    const y = clientY - rect.top;
    const percentage = 1 - Math.max(0, Math.min(1, y / height));
    return Math.round(min + percentage * (max - min));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    const newVal = calculateValue(e.clientY);
    onChange(newVal);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newVal = calculateValue(e.clientY);
    if (newVal !== value) onChange(newVal);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const thumbPos = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col items-center gap-1 relative h-32 group select-none">
      {/* Slider Track */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-grow flex items-center justify-center w-7 bg-black rounded-sm border border-[#333] relative cursor-ns-resize overflow-hidden touch-none"
      >
        {/* Internal Value Display - Integrated into the track to avoid clipping */}
        {isDragging && (
          <div className="absolute top-1 inset-x-0 text-center z-50 pointer-events-none">
            <span className="bg-[#050a09]/90 border border-dx7-teal/50 text-dx7-ink font-mono text-[9px] px-1 rounded shadow-sm animate-in fade-in duration-75">
              {value}
            </span>
          </div>
        )}

        {/* Horizontal Background Grids (Classic DX look) */}
        <div className="absolute inset-0 flex flex-col justify-between py-2 opacity-10 pointer-events-none">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-px bg-white w-full"></div>
          ))}
        </div>

        {/* Highlighted portion */}
        <div 
           className="absolute bottom-0 inset-x-0 bg-dx7-teal/10 border-t border-dx7-teal/20 pointer-events-none"
           style={{ height: `${thumbPos}%` }}
        ></div>
        
        {/* Thumb Handle */}
        <div 
          className={`absolute inset-x-1 h-2 rounded-sm shadow-sm transition-colors duration-75 pointer-events-none z-10 ${isDragging ? 'bg-[#7efab4] shadow-[0_0_8px_rgba(126,250,180,0.6)]' : 'bg-dx7-teal'}`}
          style={{ 
            bottom: `calc(${thumbPos}% - 4px)`,
            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
          }}
        >
           {/* Center line in thumb */}
           <div className="w-full h-[1px] bg-black/40 absolute top-1/2 -translate-y-1/2"></div>
        </div>
      </div>

      <span className="text-[7px] text-gray-500 font-bold uppercase tracking-tighter mt-1">{label}</span>
    </div>
  );
};

export default ControlSlider;
