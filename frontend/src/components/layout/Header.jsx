import React from 'react';
import { Activity, Users, Flame, ExternalLink, RefreshCw } from 'lucide-react';
import Badge from '../common/Badge';

export default function Header({ activeTab, onTabChange, autoRefresh, onToggleAutoRefresh, isRefreshing }) {
  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">CausalFunnel</h1>
              <Badge variant="primary" size="xs">ANALYTICS</Badge>
            </div>
            <p className="text-xs text-slate-400">User Session & Heatmap Intelligence</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => onTabChange('sessions')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'sessions'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Sessions
          </button>
          <button
            onClick={() => onTabChange('heatmap')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'heatmap'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-500" />
            Heatmap
          </button>
        </div>

        {/* Actions & Demo Link */}
        <div className="flex items-center gap-3">
          <label className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => onToggleAutoRefresh(e.target.checked)}
              className="rounded accent-indigo-600 w-4 h-4"
            />
            Live Polling (5s)
          </label>
          {(() => {
            const demoStoreUrl = (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'))
              ? 'https://casual-funnel-r1.onrender.com/demo/index.html'
              : (import.meta.env?.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/demo/index.html` : 'http://localhost:5000/demo/index.html');
            return (
              <a
                href={demoStoreUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-colors"
              >
                Live Storefront
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            );
          })()}
        </div>

      </div>
    </header>
  );
}
