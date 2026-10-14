import React from 'react';

export default function MetricCard({ title, value, icon: Icon, color = 'indigo' }) {
  const colorStyles = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600'
  }[color] || 'bg-indigo-50 text-indigo-600';

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
      {Icon && (
        <div className={`p-3 rounded-xl ${colorStyles}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">
          {value !== undefined && value !== null ? value : '--'}
        </h3>
      </div>
    </div>
  );
}
