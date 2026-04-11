import React from 'react';

export const Badge = ({ count }: { count: number }) => {
  if (count === 0) return null;
  return (
    <span className="ml-auto bg-[#534AB7] text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
      {count}
    </span>
  );
};