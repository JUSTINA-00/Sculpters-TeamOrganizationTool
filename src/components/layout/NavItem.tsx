import React from 'react';
import { Badge } from '../ui/Badge';

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

export const NavItem = ({ active, onClick, icon, label, badge }: NavItemProps) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
      ${active 
        ? 'bg-[#F3F4F6] text-[#534AB7]' 
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
  >
    <span className={active ? 'text-[#534AB7]' : 'text-gray-400'}>{icon}</span>
    {label}
    {badge !== undefined && badge > 0 && <Badge count={badge} />}
  </button>
);