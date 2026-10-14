import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../api/analyticsApi';

export function useSessions(initialLimit = 10, autoRefreshInterval = 0) {
  const [sessions, setSessions] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [pagination, setPagination] = useState({
    total_count: 0,
    page: 1,
    limit: initialLimit,
    total_pages: 1,
    has_next: false,
    has_prev: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await analyticsApi.getSessions(page, limit);
      setSessions(data.sessions || []);
      if (data.pagination) {
        setPagination(data.pagination);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const timer = setInterval(fetchSessions, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchSessions]);

  const handleSetLimit = (newLimit) => {
    setLimit(newLimit);
    setPage(1); // reset to page 1 on limit change
  };

  return {
    sessions,
    page,
    setPage,
    limit,
    setLimit: handleSetLimit,
    pagination,
    loading,
    error,
    refetch: fetchSessions
  };
}
