import React from 'react';
import { Plus } from 'lucide-react';
import { TeamEntry } from '../../types'; // Ensure TeamEntry is exported from your types file

interface TeamSwitcherProps {
  entries: TeamEntry[];
  activeTeamId: string | null;
  alertTeamIds: string[];
  onSwitch: (id: string) => void;
  onNewTeam: () => void;
}

export function TeamSwitcher({ 
  entries, 
  activeTeamId, 
  alertTeamIds, 
  onSwitch, 
  onNewTeam 
}: TeamSwitcherProps) {
  return (
    <div className="w-[60px] bg-[#1E1B3A] flex flex-col items-center py-3 gap-2 shrink-0 z-30">
      {/* Logo */}
      <div className="w-9 h-9 bg-[#534AB7] rounded-xl flex items-center justify-center mb-1 shrink-0">
        <span className="text-white font-black text-lg leading-none">S</span>
      </div>
      <div className="w-7 h-px bg-white/10 mb-1" />

      {/* Team icons */}
      <div className="flex flex-col gap-2 flex-1 w-full items-center overflow-y-auto scrollbar-hide">
        {entries.map(entry => {
          const isActive = entry.teamId === activeTeamId;
          const hasAlert = alertTeamIds.includes(entry.teamId);
          const initials = entry.teamName.slice(0, 2).toUpperCase();
          return (
            <div key={entry.teamId} className="relative w-full flex justify-center group">
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
              )}
              
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-[#1E1B3A] border border-white/10 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                <span>{entry.teamName}</span>
                {entry.role === 'leader' && (
                  <span className="ml-1.5 text-[#C4BFFE] text-[9px] font-bold uppercase">Leader</span>
                )}
                {hasAlert && (
                  <span className="ml-1.5 text-[#FCA5A5] text-[9px] font-bold">● new</span>
                )}
              </div>

              <button 
                onClick={() => onSwitch(entry.teamId)} 
                title={entry.teamName}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold transition-all
                  ${isActive 
                    ? 'bg-white text-[#534AB7] shadow-lg' 
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                  }`}
              >
                {initials}
              </button>

              {hasAlert && !isActive && (
                <span className="absolute top-0 right-2 w-2.5 h-2.5 bg-[#A32D2D] rounded-full border-2 border-[#1E1B3A]" />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-7 h-px bg-white/10 mt-1" />
      <button 
        onClick={onNewTeam} 
        title="Join or create a team"
        className="w-9 h-9 rounded-xl bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:border-white/50 hover:text-white/70 transition-all"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}