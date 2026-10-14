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
      // If loaded on a static server, point to port 5000 on the same host
      const port = window.location.port === '5000' ? '' : ':5000';
      return window.location.protocol + '//' + window.location.hostname + port + '/api/events';
    }
    return 'http://localhost:5000/api/events';
  }

  const currentScript = document.currentScript;
  const defaults = {
    endpoint: (currentScript && currentScript.getAttribute('data-endpoint')) ||
              (typeof window !== 'undefined' && window.CF_ENDPOINT) ||
              resolveDefaultEndpoint(),
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes inactivity timeout
    flushIntervalMs: 2000,             // Batch flush every 2 seconds
    maxBatchSize: 10,                  // Immediate flush if 10 events queued
    maxQueueCap: 50,                   // Prevent unbounded memory growth on disconnect
    debug: false
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

  // --- Session Manager ---
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'sess_' + crypto.randomUUID();
    }
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }

  function getActiveSessionId() {
    const now = Date.now();
    const existing = safeGetItem(STORAGE_KEYS.SESSION);
    const lastActive = parseInt(safeGetItem(STORAGE_KEYS.LAST_ACTIVE) || '0', 10);

    if (existing && (now - lastActive < config.sessionTimeoutMs)) {
      safeSetItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
      return existing;
    }

    const newSession = generateUUID();
    safeSetItem(STORAGE_KEYS.SESSION, newSession);
    safeSetItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
    log('Initialized session:', newSession);
    return newSession;
  }

  // --- True Network Request Batch Dispatcher ---
  function dispatchBatch(batchItems) {
    if (!batchItems || batchItems.length === 0) return;
    const dataString = JSON.stringify(batchItems);

    // 1. Try sendBeacon with batch array (best for unload)
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([dataString], { type: 'application/json' });
        const accepted = navigator.sendBeacon(config.endpoint, blob);
        if (accepted) {
          log(`Dispatched batch of ${batchItems.length} event(s) via sendBeacon`);
          return true;
        }
      } catch (err) {
        log('sendBeacon failed, falling back to fetch', err);
      }
    }

    // 2. Fallback to fetch with keepalive & retry queue on network drop
    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dataString,
      keepalive: true
    }).then(function (res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      log(`Dispatched batch of ${batchItems.length} event(s) via fetch`);
    }).catch(function (err) {
      log('Batch dispatch failed, requeueing events:', err.message);
      // Restore failed events to the front of queue without exceeding cap
      eventQueue = batchItems.concat(eventQueue).slice(0, config.maxQueueCap);
    });

    return true;
  }

  // --- Queue Manager ---
  function enqueue(event) {
    if (eventQueue.length < config.maxQueueCap) {
      eventQueue.push(event);
    }

    if (eventQueue.length >= config.maxBatchSize) {
      flush();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flush, config.flushIntervalMs);
    }
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    if (eventQueue.length === 0) return;

    // Pull entire queue into a single batch
    const batch = eventQueue.slice();
    eventQueue = [];

    dispatchBatch(batch);
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

    // Guaranteed flush on navigation / tab close
    const exitFlush = function () { flush(); };
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flush();
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
