import { apiClient } from './client';

export const analyticsApi = {
  getOverview: () => apiClient('/overview'),

  getSessions: (page = 1, limit = 10) =>
    apiClient(`/sessions?page=${page}&limit=${limit}`),

  getSessionJourney: (sessionId) =>
    apiClient(`/sessions/${encodeURIComponent(sessionId)}`),

  getHeatmapClicks: (pageUrl) =>
    apiClient(`/analytics/clicks?url=${encodeURIComponent(pageUrl)}`),

  getTrackedPages: () =>
    apiClient('/analytics/pages'),
};
