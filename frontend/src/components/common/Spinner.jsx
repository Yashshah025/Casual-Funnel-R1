import React from 'react';

export default function Spinner({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3'
  };

  return (
    <div
      className={`rounded-full border-indigo-600 border-t-transparent animate-spin ${sizeMap[size] || sizeMap.md} ${className}`}
    />
  );
}
