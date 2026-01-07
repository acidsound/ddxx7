
import React, { useState, useRef } from 'react';

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
    <div className="flex flex-col items-center gap-1 relative h-28 md:h-32 group select-none w-5 md:w-6">
      {/* Slider Track */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-grow flex items-center justify-center w-full bg-black rounded-sm border border-[#333] relative cursor-ns-resize overflow-hidden touch-none"
      >
        {/* Internal Value Popover */}
        {isDragging && (
          <div className="absolute top-1 inset-x-0 text-center z-50 pointer-events-none">
            <span className="bg-[#050a09]/95 border border-dx7-teal/50 text-dx7-teal font-mono text-[8px] px-0.5 rounded shadow-sm animate-in fade-in duration-75">
              {value}
            </span>
          </div>
        )}

        {/* Grids */}
        <div className="absolute inset-0 flex flex-col justify-between py-1.5 opacity-10 pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-px bg-white w-full"></div>
          ))}
        </div>

        {/* Level Highlight */}
        <div 
           className="absolute bottom-0 inset-x-0 bg-dx7-teal/10 border-t border-dx7-teal/20 pointer-events-none"
           style={{ height: `${thumbPos}%` }}
        ></div>
        
        {/* Thumb */}
        <div 
          className={`absolute inset-x-0.5 h-1.5 md:h-2 rounded-sm shadow-sm transition-colors duration-75 pointer-events-none z-10 ${isDragging ? 'bg-[#7efab4] shadow-[0_0_6px_rgba(126,250,180,0.6)]' : 'bg-dx7-teal'}`}
          style={{ 
            bottom: `calc(${thumbPos}% - 3px)`,
            boxShadow: '0 0 3px rgba(0,0,0,0.5)'
          }}
        >
        </div>
      </div>

      <span className="text-[7px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">{label}</span>
    </div>
  );
};

export default ControlSlider;
