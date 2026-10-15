/**
 * CausalFunnel Analytics Tracker SDK
 * 
 * Features:
 * - Session tracking with sliding 30-min inactivity window & UUID persistence
 * - In-memory event queue with true single-request network batching
 * - Failed dispatch retry with bounded queue cap
 * - Safe storage wrapper with memory fallback for restricted environments
 * - Captures document-relative (pageX, pageY), normalized percentages (pct_x, pct_y),
 *   viewport dimensions, and full document bounds for accurate heatmap scaling
 * - Guaranteed unload flush via visibilitychange, pagehide, and beforeunload
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CFTracker = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Dynamic Endpoint Resolution ---
  function resolveDefaultEndpoint() {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      // If running locally, point to local Flask port 5000
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return window.location.protocol + '//' + hostname + ':5000/api/events';
      }
      // If running on Render or Vercel, use same-origin /api/events
      if (hostname.includes('onrender.com') || hostname.includes('vercel.app')) {
        return window.location.origin + '/api/events';
      }
      return 'https://casual-funnel-r1.onrender.com/api/events';
    }
    return 'https://casual-funnel-r1.onrender.com/api/events';
  }

  const currentScript = document.currentScript;
  const rawScriptEndpoint = currentScript && currentScript.getAttribute('data-endpoint');
  // Discard localhost endpoint if running in the cloud
  const isCloudHost = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  const scriptEndpoint = (isCloudHost && rawScriptEndpoint && rawScriptEndpoint.includes('localhost')) ? null : rawScriptEndpoint;

  const defaults = {
    endpoint: (typeof window !== 'undefined' && window.CF_ENDPOINT) ||
              scriptEndpoint ||
              resolveDefaultEndpoint(),
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes inactivity timeout
    flushIntervalMs: 1000,             // Batch flush every 1 second for fast feedback
    maxBatchSize: 5,                   // Flush quickly
    maxQueueCap: 50,                   // Prevent unbounded memory growth on disconnect
    debug: true
  };

  const config = Object.assign({}, defaults, (typeof window !== 'undefined' && window.CF_CONFIG) || {});

  const STORAGE_KEYS = {
    SESSION: 'cf_session_id',
    LAST_ACTIVE: 'cf_last_active'
  };

  // Safe Storage fallback (handles private browsing / blocked cookies)
  const memoryFallback = {};
  function safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryFallback[key] || null;
    }
  }

  function safeSetItem(key, val) {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      memoryFallback[key] = val;
    }
  }

  function safeRemoveItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      delete memoryFallback[key];
    }
  }

  // Internal queue state
  let eventQueue = [];
  let flushTimer = null;

  function log(...args) {
    if (config.debug && typeof console !== 'undefined') {
      console.log('[CF Tracker]', ...args);
    }
  }

  // --- Session & Event ID Generators ---
  function generateId(prefix) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return prefix + crypto.randomUUID();
    }
    return prefix + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  function getActiveSessionId() {
    const now = Date.now();
    const existing = safeGetItem(STORAGE_KEYS.SESSION);
    const lastActive = parseInt(safeGetItem(STORAGE_KEYS.LAST_ACTIVE) || '0', 10);

    if (existing && (now - lastActive < config.sessionTimeoutMs)) {
      safeSetItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
      return existing;
    }

    const newSession = generateId('sess_');
    safeSetItem(STORAGE_KEYS.SESSION, newSession);
    safeSetItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
    log('Initialized session:', newSession);
    return newSession;
  }

  // --- Network Request Batch Dispatchers ---
  // Ordinary flushes use standard fetch with response verification and retry
  function dispatchBatchFetch(batchItems) {
    if (!batchItems || batchItems.length === 0) return;
    const dataString = JSON.stringify(batchItems);

    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dataString
    }).then(function (res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      log(`Dispatched batch of ${batchItems.length} event(s) successfully via fetch`);
    }).catch(function (err) {
      log('Batch dispatch failed, restoring events to retry queue:', err.message);
      // Restore failed events to the front of queue without exceeding cap
      eventQueue = batchItems.concat(eventQueue).slice(0, config.maxQueueCap);
    });
  }

  // Page exit is best-effort: try sendBeacon first, fallback to fetch with keepalive
  function dispatchBatchUnload(batchItems) {
    if (!batchItems || batchItems.length === 0) return;
    const dataString = JSON.stringify(batchItems);

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([dataString], { type: 'application/json' });
        const accepted = navigator.sendBeacon(config.endpoint, blob);
        if (accepted) {
          log(`Unload batch of ${batchItems.length} event(s) queued via sendBeacon`);
          return true;
        }
      } catch (err) {
        log('sendBeacon failed during unload, falling back to keepalive fetch', err);
      }
    }

    try {
      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dataString,
        keepalive: true
      });
    } catch (e) {
      log('Unload keepalive fetch failed:', e);
    }
  }

  // --- Queue Manager ---
  function enqueue(event) {
    if (eventQueue.length < config.maxQueueCap) {
      eventQueue.push(event);
    }

    if (eventQueue.length >= config.maxBatchSize) {
      flush(false);
    } else if (!flushTimer) {
      flushTimer = setTimeout(function () { flush(false); }, config.flushIntervalMs);
    }
  }

  function flush(isUnload) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (eventQueue.length === 0) return;

    // Pull entire queue into a single batch
    const batch = eventQueue.slice();
    eventQueue = [];

    if (isUnload) {
      dispatchBatchUnload(batch);
    } else {
      dispatchBatchFetch(batch);
    }
  }

  // --- Dimensions & Normalization Helpers ---
  function getViewportDimensions() {
    return {
      width: window.innerWidth || document.documentElement.clientWidth || 0,
      height: window.innerHeight || document.documentElement.clientHeight || 0
    };
  }

  function getDocumentDimensions() {
    const doc = document.documentElement;
    const body = document.body;
    return {
      width: Math.max(doc.scrollWidth, body ? body.scrollWidth : 0, doc.clientWidth),
      height: Math.max(doc.scrollHeight, body ? body.scrollHeight : 0, doc.clientHeight)
    };
  }

  // --- Event Handlers ---
  function trackPageView() {
    const payload = {
      event_id: generateId('evt_'),
      session_id: getActiveSessionId(),
      event_type: 'page_view',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: getViewportDimensions(),
      document: getDocumentDimensions()
    };
    enqueue(payload);
  }

  function trackClick(e) {
    const x = e.pageX !== undefined ? e.pageX : e.clientX + (document.documentElement.scrollLeft || (document.body && document.body.scrollLeft) || 0);
    const y = e.pageY !== undefined ? e.pageY : e.clientY + (document.documentElement.scrollTop || (document.body && document.body.scrollTop) || 0);

    const docBounds = getDocumentDimensions();
    const roundX = Math.round(x);
    const roundY = Math.round(y);

    // Compute normalized percentage coordinates against full document dimensions
    const pctX = docBounds.width > 0 ? Number(((roundX / docBounds.width) * 100).toFixed(3)) : 0;
    const pctY = docBounds.height > 0 ? Number(((roundY / docBounds.height) * 100).toFixed(3)) : 0;

    const payload = {
      event_id: generateId('evt_'),
      session_id: getActiveSessionId(),
      event_type: 'click',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      coordinates: {
        x: roundX,
        y: roundY
      },
      normalized: {
        pct_x: Math.min(100, Math.max(0, pctX)),
        pct_y: Math.min(100, Math.max(0, pctY))
      },
      viewport: getViewportDimensions(),
      document: docBounds
    };

    enqueue(payload);
  }

  // --- Lifecycle Listeners ---
  function init() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      trackPageView();
    } else {
      window.addEventListener('DOMContentLoaded', trackPageView);
    }

    document.addEventListener('click', trackClick, true);

    // Best-effort flush on page exit
    const exitFlush = function () { flush(true); };
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('pagehide', exitFlush);
    window.addEventListener('beforeunload', exitFlush);

    log('Tracker initialized. Endpoint:', config.endpoint);
  }

  init();

  return {
    getSessionId: getActiveSessionId,
    trackPageView: trackPageView,
    trackCustomEvent: enqueue,
    flush: flush,
    resetSession: function () {
      safeRemoveItem(STORAGE_KEYS.SESSION);
      safeRemoveItem(STORAGE_KEYS.LAST_ACTIVE);
      return getActiveSessionId();
    }
  };
});
