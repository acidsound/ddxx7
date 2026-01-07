import React, { useState, useRef } from 'react';

interface FaderProps {
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    height?: number;
    label?: string;
}

export default function ControlFader({ value, min, max, onChange, height = 50, label }: FaderProps & { key?: React.Key }) {
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
        let newVal = startVal.current + (deltaY * (range / height)) * sensitivity;
        newVal = Math.max(min, Math.min(max, Math.round(newVal)));
        if (newVal !== value) onChange(newVal);
    };

    const handlePointerUp = () => setIsDragging(false);

    const percent = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex flex-col items-center group relative pt-1">
            {isDragging && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#050a09]/95 border border-dx7-teal/50 text-dx7-teal font-mono text-[9px] px-1.5 py-0.5 rounded shadow-lg z-[300] whitespace-nowrap">
                    {value}
                </div>
            )}
            <div
                className="relative cursor-ns-resize touch-none w-4 bg-[#080808] rounded-sm border border-[#222] shadow-inner"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ height }}
            >
                {/* Track center line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-1 bottom-1 w-px bg-white/5" />

                {/* Thumb */}
                <div
                    className="absolute left-0 right-0 h-6 bg-[#444] border border-[#111] rounded-sm shadow-[0_2px_4px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col justify-center items-center pointer-events-none"
                    style={{ bottom: `calc(${percent}% - 12px)` }}
                >
                    {/* Indicator Lines */}
                    <div className="w-full h-px bg-[#222]" />
                    <div className="w-full h-[2px] bg-dx7-teal shadow-[0_0_4px_rgba(0,212,193,0.8)]" />
                    <div className="w-full h-px bg-[#222]" />
                </div>
            </div>
            {label && <span className="text-[6px] text-gray-400 font-bold uppercase mt-1">{label}</span>}
        </div>
    );
}
