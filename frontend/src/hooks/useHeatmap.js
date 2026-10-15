import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../api/analyticsApi';

export function useHeatmap(initialUrl = '', autoRefreshInterval = 0) {
  const [pages, setPages] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState(initialUrl);
  const [clickData, setClickData] = useState(null);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingClicks, setLoadingClicks] = useState(false);
  const [error, setError] = useState(null);

  // Load distinct tracked pages
  const fetchPages = useCallback(async () => {
    try {
      const data = await analyticsApi.getTrackedPages();
      const pageList = data.pages || [];
      setPages(pageList);
      if (pageList.length > 0 && !selectedUrl) {
        setSelectedUrl(pageList[0]);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPages(false);
    }
  }, [selectedUrl]);

  // Load clicks for the selected URL
  const fetchClicks = useCallback(async () => {
    if (!selectedUrl) return;
    try {
      const data = await analyticsApi.getHeatmapClicks(selectedUrl);
      setClickData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingClicks(false);
    }
  }, [selectedUrl]);

  useEffect(() => {
    setLoadingPages(true);
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const timer = setInterval(fetchPages, autoRefreshInterval * 2);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchPages]);

  useEffect(() => {
    setLoadingClicks(true);
    fetchClicks();
  }, [fetchClicks]);

  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const timer = setInterval(fetchClicks, autoRefreshInterval);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchClicks]);

  return {
    pages,
    selectedUrl,
    setSelectedUrl,
    clickData,
    loadingPages,
    loadingClicks,
    error,
    refetchClicks: fetchClicks,
    refetchPages: fetchPages
  };
}
