import React, { useEffect, useState } from 'react';
import { X, Clock, MousePointer, Eye, Calendar, ArrowRight, ExternalLink } from 'lucide-react';

export default function UserJourneyModal({ sessionId, onClose }) {
  const [journeyData, setJourneyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/sessions/${encodeURIComponent(sessionId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch session journey');
        return res.json();
      })
      .then(data => {
        setJourneyData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [sessionId]);

  const formatTime = (isoString) => {
    if (!isoString) return '--:--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="text-lg font-bold text-slate-800">User Session Journey</h3>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-1 select-all">
              ID: {sessionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm">Loading session events...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          {!loading && !error && journeyData && (
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 text-xs text-slate-500">
                <span>Total Events: <strong className="text-slate-800 text-sm font-semibold">{journeyData.total_events}</strong></span>
                <span>Date: <strong className="text-slate-700">{formatDate(journeyData.events[0]?.timestamp)}</strong></span>
              </div>

              {/* Timeline Container */}
              <div className="relative border-l-2 border-indigo-100 ml-4 space-y-6">
                {journeyData.events.map((event, idx) => {
                  const isPageView = event.event_type === 'page_view';
                  return (
                    <div key={event.id || idx} className="relative pl-6 group">
                      {/* Timeline dot icon */}
                      <span className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                        isPageView ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {isPageView ? <Eye className="w-4 h-4" /> : <MousePointer className="w-4 h-4" />}
                      </span>

                      {/* Event Card */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            isPageView ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isPageView ? 'PAGE VIEW' : 'CLICK'}
                          </span>
                          <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(event.timestamp)}
                          </span>
                        </div>

                        {/* Page URL */}
                        <div className="mt-2 text-xs font-mono text-slate-600 break-all flex items-start gap-1">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span>{event.url}</span>
                        </div>

                        {/* Click details */}
                        {!isPageView && event.coordinates && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center gap-4 text-xs">
                            <span className="text-slate-500">
                              Coords: <strong className="text-slate-800 font-mono">X: {event.coordinates.x}px, Y: {event.coordinates.y}px</strong>
                            </span>
                            {event.viewport && (
                              <span className="text-slate-400">
                                Viewport: {event.viewport.width}x{event.viewport.height}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
