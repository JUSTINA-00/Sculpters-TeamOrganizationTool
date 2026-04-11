import React from 'react';
import { AppState, NodeStatus } from '../../types';

export const SyncIndicator = ({ status }: { status: AppState['syncStatus'] }) => {
  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FAEEDA] text-[#854F0B] text-xs font-medium">
        <span className="animate-spin">◌</span> syncing
      </div>
    );
  }
  if (status === 'offline') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#FEE2E2] text-[#A32D2D] text-xs font-medium">
        <span>●</span> offline
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#D1FAE5] text-[#1D9E75] text-xs font-medium">
      <span>●</span> synced
    </div>
  );
};

export const NodeItem = ({ label, type, status }: { label: string; type: string; status: NodeStatus }) => (
  <div className="flex items-center gap-2">
    <div className={`w-2 h-2 rounded-full ${status === 'alive' ? 'bg-[#1D9E75]' : 'bg-[#A32D2D]'}`} />
    <span className="text-xs font-medium text-gray-700">{label}</span>
    <span className="text-[9px] text-gray-400 ml-auto uppercase tracking-tighter">{type}</span>
  </div>
);