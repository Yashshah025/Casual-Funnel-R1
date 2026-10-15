/**
 * Base API client with consistent response parsing, automatic environment resolution,
 * and reliable dual-path network fallback.
 */

// If explicitly provided via Vite env, respect it; otherwise use same-origin /api (proxied in both dev & Vercel)
const EXPLICIT_API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '';
const CLOUD_FALLBACK_BASE = 'https://casual-funnel-r1.onrender.com/api';

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
  // Attach API key for dashboard auth if configured via env or safe local storage
  const apiKey = safeGetApiKey() || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_API_KEY) || null;

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
    ...options.headers,
  };

  const config = {
    headers,
    ...options,
  };

  // 1. Determine primary target URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const primaryUrl = EXPLICIT_API_BASE 
    ? `${EXPLICIT_API_BASE.replace(/\/$/, '')}/api${cleanEndpoint}` 
    : `/api${cleanEndpoint}`;

  try {
    const res = await fetch(primaryUrl, config);
    const data = await res.json();

    if (!res.ok || data.success === false) {
      const errorMessage = data?.error?.message || `HTTP ${res.status}: Failed to fetch`;
      const err = new Error(errorMessage);
      err.status = res.status;
      err.details = data?.error?.details;
      throw err;
    }

    return data.data;
  } catch (primaryErr) {
    // If not already calling the cloud backend and error is a network connection failure, try direct cloud fallback
    const isCloudAlready = primaryUrl.includes('casual-funnel-r1.onrender.com');
    if (!isCloudAlready && (primaryErr.name === 'TypeError' || primaryErr.message?.includes('Failed to fetch'))) {
      try {
        const fallbackUrl = `${CLOUD_FALLBACK_BASE}${cleanEndpoint}`;
        const fallbackRes = await fetch(fallbackUrl, config);
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok && fallbackData.success !== false) {
          return fallbackData.data;
        }
      } catch (fallbackErr) {
        // Fall through to throw original error
      }
    }

    console.error(`[API Error] ${endpoint}:`, primaryErr.message);
    throw primaryErr;
  }
}
