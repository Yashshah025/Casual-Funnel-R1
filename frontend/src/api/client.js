/**
 * Base API client with consistent response parsing and error handling
 */
const BASE_URL = '/api';

export async function apiClient(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  // Attach API key for dashboard auth if configured via env or local storage
  const apiKey = (typeof window !== 'undefined' && (window.localStorage.getItem('cf_admin_api_key') || import.meta.env?.VITE_ADMIN_API_KEY)) || null;

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...options.headers,
  };

  const config = {
    headers,
    ...options,
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json();

    if (!res.ok || data.success === false) {
      const errorMessage = data?.error?.message || `HTTP ${res.status}: Failed to fetch`;
      const err = new Error(errorMessage);
      err.status = res.status;
      err.details = data?.error?.details;
      throw err;
    }

    return data.data;
  } catch (err) {
    console.error(`[API Error] ${endpoint}:`, err.message);
    throw err;
  }
}
