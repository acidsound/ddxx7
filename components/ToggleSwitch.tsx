import React from 'react';

interface ToggleSwitchProps {
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
}

export default function ToggleSwitch({ label, active, onChange }: ToggleSwitchProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 select-none w-full max-w-[80px] mx-auto">
      <div className="flex items-center gap-2">
        <div 
          onClick={() => onChange(!active)}
          className="w-10 h-5 bg-[#1a1a1a] rounded-sm border border-[#333] shadow-inner relative cursor-pointer group shrink-0"
        >
          <div 
            className={`absolute top-0.5 bottom-0.5 w-[50%] bg-[#333] border border-[#444] rounded-sm transition-all duration-100 shadow-md`}
            style={{ left: active ? 'calc(50% - 2px)' : '2px' }}
          >
            <div className={`absolute inset-x-1 top-1 bottom-1 ${active ? 'bg-gradient-to-l' : 'bg-gradient-to-r'} from-[#444] to-[#222] opacity-30`}></div>
          </div>
        </div>
        <div className={`w-1.5 h-1.5 rounded-full border border-black shrink-0 transition-all ${active ? 'bg-[#7efab4] shadow-[0_0_8px_#7efab4]' : 'bg-[#1a221d]'}`}></div>
      </div>
      <span className="text-[7.5px] md:text-[8px] font-bold text-gray-300 uppercase tracking-tighter text-center leading-[1.1] truncate w-full px-0.5">
        {label}
      </span>
    </div>
  );
}