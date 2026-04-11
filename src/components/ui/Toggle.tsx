import React from 'react';

interface ToggleProps {
  value: boolean;
  onChange: () => void;
}

export const Toggle = ({ value, onChange }: ToggleProps) => (
  <div 
    onClick={onChange} 
    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${
      value ? 'bg-[#534AB7]' : 'bg-gray-200'
    }`}
  >
    <div 
      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
        value ? 'left-5' : 'left-0.5'
      }`} 
    />
  </div>
);