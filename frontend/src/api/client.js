/**
 * Base API client with consistent response parsing and error handling
 */
let API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
if (!API_BASE && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
  API_BASE = 'https://casual-funnel-r1.onrender.com';
}
const BASE_URL = API_BASE ? `${API_BASE.replace(/\/$/, '')}/api` : '/api';

function safeGetApiKey() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('cf_admin_api_key');
    }
  } catch (e) {
    // Gracefully ignore SecurityError or blocked storage in restricted frames
  }
  return null;
}

export async function apiClient(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  
  // Attach API key for dashboard auth if configured via env or safe local storage
  const apiKey = safeGetApiKey() || import.meta.env?.VITE_ADMIN_API_KEY || null;

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
