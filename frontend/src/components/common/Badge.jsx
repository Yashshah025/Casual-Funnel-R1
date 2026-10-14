import React from 'react';

export default function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  const variantStyles = {
    default: 'bg-slate-100 text-slate-800',
    primary: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200/60',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200/60'
  }[variant] || 'bg-slate-100 text-slate-800';

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1'
  }[size] || 'text-xs px-2.5 py-0.5';

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${variantStyles} ${sizeStyles} ${className}`}>
      {children}
    </span>
  );
}
