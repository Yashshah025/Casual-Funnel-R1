import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../api/analyticsApi';

export function useHeatmap(initialUrl = '') {
  const [pages, setPages] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState(initialUrl);
  const [clickData, setClickData] = useState(null);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingClicks, setLoadingClicks] = useState(false);
  const [error, setError] = useState(null);

  // Load distinct tracked pages
  const fetchPages = useCallback(async () => {
    setLoadingPages(true);
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
    setLoadingClicks(true);
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
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    fetchClicks();
  }, [fetchClicks]);

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
