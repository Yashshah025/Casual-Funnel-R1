/**
 * CausalFunnel Analytics Tracker (Production Grade)
 * 
 * Features:
 * - Session tracking with sliding 30-min inactivity window & UUID persistence
 * - In-memory event batching & scheduled queue flushing
 * - Guaranteed dispatch on page exit (visibilitychange / pagehide / beforeunload)
 * - Zero external dependencies, UMD pattern, non-blocking asynchronous execution
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

  // --- Configuration Defaults ---
  const currentScript = document.currentScript;
  const defaults = {
    endpoint: (currentScript && currentScript.getAttribute('data-endpoint')) || 'http://localhost:5000/api/events',
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
    flushIntervalMs: 2000,             // Flush queue every 2 seconds
    maxBatchSize: 10,                  // Flush immediately if 10 events queued
    debug: false
  };

  const config = Object.assign({}, defaults, window.CF_CONFIG || {});

  const STORAGE_KEYS = {
    SESSION: 'cf_session_id',
    LAST_ACTIVE: 'cf_last_active'
  };

  // Internal state
  let eventQueue = [];
  let flushTimer = null;

  // --- Logger ---
  function log(...args) {
    if (config.debug) {
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
    const existing = localStorage.getItem(STORAGE_KEYS.SESSION);
    const lastActive = parseInt(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE) || '0', 10);

    if (existing && (now - lastActive < config.sessionTimeoutMs)) {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
      return existing;
    }

    const newSession = generateUUID();
    localStorage.setItem(STORAGE_KEYS.SESSION, newSession);
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, now.toString());
    log('Initialized new session:', newSession);
    return newSession;
  }

  // --- Event Dispatcher ---
  function dispatchPayload(payload) {
    const dataString = JSON.stringify(payload);

    // 1. Try sendBeacon (preferred for analytics, especially on unload)
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([dataString], { type: 'application/json' });
        const enqueued = navigator.sendBeacon(config.endpoint, blob);
        if (enqueued) return true;
      } catch (err) {
        log('sendBeacon failed, falling back to fetch', err);
      }
    }

    // 2. Fallback to fetch with keepalive
    fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dataString,
      keepalive: true
    }).catch(err => {
      log('Fetch dispatch failed:', err.message);
    });

    return true;
  }

  // --- Queue & Batch Manager ---
  function enqueue(event) {
    eventQueue.push(event);

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

    // Send items individually or in batch (our backend accepts standard event object)
    const itemsToSend = eventQueue.slice();
    eventQueue = [];

    itemsToSend.forEach(item => {
      dispatchPayload(item);
    });

    log(`Flushed ${itemsToSend.length} event(s)`);
  }

  // --- Trackers ---
  function trackPageView() {
    const payload = {
      session_id: getActiveSessionId(),
      event_type: 'page_view',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    enqueue(payload);
  }

  function trackClick(e) {
    const x = e.pageX !== undefined ? e.pageX : e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft);
    const y = e.pageY !== undefined ? e.pageY : e.clientY + (document.documentElement.scrollTop || document.body.scrollTop);

    const payload = {
      session_id: getActiveSessionId(),
      event_type: 'click',
      url: window.location.href,
      timestamp: new Date().toISOString(),
      coordinates: {
        x: Math.round(x),
        y: Math.round(y)
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
    enqueue(payload);
  }

  // --- Lifecycle Listeners ---
  function init() {
    // 1. Initial Page View
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      trackPageView();
    } else {
      window.addEventListener('DOMContentLoaded', trackPageView);
    }

    // 2. Global Click Capture
    document.addEventListener('click', trackClick, true);

    // 3. Flush on Page Exit
    const exitHandler = () => flush();
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', exitHandler);
    window.addEventListener('beforeunload', exitHandler);

    log('Tracker initialized successfully.');
  }

  // Auto initialize
  init();

  // Public SDK
  return {
    getSessionId: getActiveSessionId,
    trackPageView: trackPageView,
    trackCustomEvent: enqueue,
    flush: flush,
    resetSession: function () {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
      return getActiveSessionId();
    }
  };
});
