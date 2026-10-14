import React, { useState } from 'react';
import { Users, Layers, Eye, MousePointer, RefreshCw } from 'lucide-react';
import MetricCard from './common/MetricCard';
import SessionTable from './sessions/SessionTable';
import UserJourneyTimeline from './sessions/UserJourneyTimeline';

export default function SessionsView({
  sessions,
  pagination,
  onPageChange,
  onLimitChange,
  overview,
  loading,
  onRefresh
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  return (
    <div className="space-y-6">
      {/* 1. Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sessions"
          value={overview?.total_sessions}
          icon={Users}
          color="indigo"
        />
        <MetricCard
          title="Total Events"
          value={overview?.total_events}
          icon={Layers}
          color="blue"
        />
        <MetricCard
          title="Page Views"
          value={overview?.total_page_views}
          icon={Eye}
          color="emerald"
        />
        <MetricCard
          title="Total Clicks"
          value={overview?.total_clicks}
          icon={MousePointer}
          color="amber"
        />
      </div>

      {/* 2. Action Bar */}
      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 rounded-xl shadow-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* 3. Paginated Sessions List Table */}
      <SessionTable
        sessions={sessions}
        pagination={pagination}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
        loading={loading}
        onSelectSession={setSelectedSessionId}
      />

      {/* 4. Journey Modal */}
      {selectedSessionId && (
        <UserJourneyTimeline
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}
