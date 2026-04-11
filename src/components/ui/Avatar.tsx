import React from 'react';

interface AvatarProps {
  initials: string;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Avatar = ({ initials, color, size = 'md' }: AvatarProps) => {
  const sizes = { 
    sm: 'w-6 h-6 text-[10px]', 
    md: 'w-8 h-8 text-xs', 
    lg: 'w-10 h-10 text-sm', 
    xl: 'w-16 h-16 text-xl' 
  };
  return (
    <div 
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
};