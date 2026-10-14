import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Search, Clock, MousePointer, Eye, Layers } from 'lucide-react';
import Badge from '../common/Badge';

export default function SessionTable({
  sessions,
  pagination = {},
  onPageChange,
  onLimitChange,
  loading,
  onSelectSession
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const {
    total_count = 0,
    page = 1,
    limit = 10,
    total_pages = 1,
    has_next = false,
    has_prev = false
  } = pagination;

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '< 1s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '--';
    const date = new Date(isoString);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredSessions = (sessions || []).filter(s =>
    s.session_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.pages_visited && s.pages_visited.some(url => url.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const startRecord = total_count > 0 ? (page - 1) * limit + 1 : 0;
  const endRecord = Math.min(page * limit, total_count);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - 2);
    let end = Math.min(total_pages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      
      {/* 1. Table Header Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-800">Tracked User Sessions</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
              {total_count} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Click any session row to inspect the user journey step-by-step.</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter current page..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 2. Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
            <tr>
              <th className="py-3 px-5">Session Identifier</th>
              <th className="py-3 px-4 text-center">Total Events</th>
              <th className="py-3 px-4 text-center">Page Views</th>
              <th className="py-3 px-4 text-center">Clicks</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-5">Last Active</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredSessions.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  {loading ? 'Fetching active sessions...' : 'No sessions found on this page.'}
                </td>
              </tr>
            ) : (
              filteredSessions.map((session) => (
                <tr
                  key={session.session_id}
                  onClick={() => onSelectSession(session.session_id)}
                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-5 font-mono text-xs font-medium text-indigo-900">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="truncate max-w-[200px]" title={session.session_id}>
                        {session.session_id}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant="default">{session.total_events}</Badge>
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                    {session.page_views}
                  </td>
                  <td className="py-3.5 px-4 text-center text-amber-600 font-medium">
                    {session.clicks}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                    {formatDuration(session.duration_seconds)}
                  </td>
                  <td className="py-3.5 px-5 text-xs text-slate-500">
                    {formatDate(session.last_active)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 group-hover:text-indigo-800">
                      View Journey <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3. Bottom Pagination Bar */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        
        {/* Left: Range Readout */}
        <div>
          Showing <span className="font-semibold text-slate-800">{startRecord}</span> to{' '}
          <span className="font-semibold text-slate-800">{endRecord}</span> of{' '}
          <span className="font-semibold text-slate-800">{total_count}</span> sessions
        </div>

        {/* Center: Rows Per Page Selector */}
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        {/* Right: Page Navigation Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange && onPageChange(page - 1)}
            disabled={!has_prev || loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((num) => (
              <button
                key={num}
                onClick={() => onPageChange && onPageChange(num)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                  page === num
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange && onPageChange(page + 1)}
            disabled={!has_next || loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
}
