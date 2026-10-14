import React from 'react';
import { Globe, MousePointer, RefreshCw } from 'lucide-react';

export default function HeatmapControls({
  pages,
  selectedUrl,
  onSelectUrl,
  totalClicks,
  dotSize,
  onChangeDotSize,
  loadingPages,
  loadingClicks,
  onRefresh
}) {
  return (
    <div className="bg-white p-3.5 px-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
      {/* URL Selector */}
      <div className="flex-1 w-full md:w-auto">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-indigo-600" />
          Tracked Webpage URL
        </label>

        {loadingPages ? (
          <div className="text-xs text-slate-400 py-2">Loading tracked URLs...</div>
        ) : pages.length === 0 ? (
          <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
            No tracked URLs recorded yet. Open the demo store and click anywhere to record interactions!
          </div>
        ) : (
          <select
            value={selectedUrl}
            onChange={(e) => onSelectUrl(e.target.value)}
            className="w-full md:max-w-xl text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            {pages.map((url) => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Visual Controls */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
        <div className="text-right">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recorded Clicks</p>
          <p className="text-xl font-bold text-slate-800 flex items-center gap-1 justify-end">
            <MousePointer className="w-4 h-4 text-amber-500" />
            {totalClicks || 0}
          </p>
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
          <label className="text-xs text-slate-500 font-medium whitespace-nowrap">Radius:</label>
          <input
            type="range"
            min="12"
            max="48"
            value={dotSize}
            onChange={(e) => onChangeDotSize(Number(e.target.value))}
            className="w-20 accent-indigo-600"
          />
        </div>

        <button
          onClick={onRefresh}
          disabled={loadingClicks}
          className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          title="Refresh click points"
        >
          <RefreshCw className={`w-4 h-4 ${loadingClicks ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
  );
}
