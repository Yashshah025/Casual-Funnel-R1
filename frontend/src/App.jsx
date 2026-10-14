import React, { useState } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import SessionsView from './components/SessionsView';
import HeatmapView from './components/HeatmapView';
import { useOverview } from './hooks/useOverview';
import { useSessions } from './hooks/useSessions';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('sessions');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const pollInterval = autoRefresh ? 5000 : 0;
  const { overview, loading: overviewLoading, error: overviewError, refetch: refetchOverview } = useOverview(pollInterval);
  const {
    sessions,
    page,
    setPage,
    limit,
    setLimit,
    pagination,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions
  } = useSessions(10, pollInterval);

  const handleRefreshAll = () => {
    refetchOverview();
    refetchSessions();
  };

  const activeError = overviewError || sessionsError;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 1. Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={setAutoRefresh}
        isRefreshing={overviewLoading || sessionsLoading}
      />

      {/* 2. Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error notification banner */}
        {activeError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-semibold">API Connection Alert</p>
                <p className="text-xs text-rose-600">{activeError}</p>
              </div>
            </div>
            <button
              onClick={handleRefreshAll}
              className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'sessions' ? (
          <SessionsView
            sessions={sessions}
            pagination={pagination}
            onPageChange={setPage}
            onLimitChange={setLimit}
            overview={overview}
            loading={sessionsLoading || overviewLoading}
            onRefresh={handleRefreshAll}
          />
        ) : (
          <HeatmapView />
        )}
      </main>

      {/* 3. Footer */}
      <Footer />
    </div>
  );
}
