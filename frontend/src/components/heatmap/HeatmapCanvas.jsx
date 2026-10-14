import React, { useState, useRef } from 'react';
import { Flame, MousePointer, RefreshCw, Crosshair, HelpCircle, Info, Sparkles } from 'lucide-react';

export default function HeatmapCanvas({ points = [], dotSize = 24, loading = false }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, active: false });
  const canvasRef = useRef(null);

  // Helper to resolve normalized percentage coordinates for each point
  const getPointCoords = (pt) => {
    let posX = pt.pct_x;
    let posY = pt.pct_y;

    // Fallback if pct_x / pct_y are missing (e.g. legacy events before migration)
    if (posX == null || isNaN(posX)) {
      const docW = pt.document?.width || pt.viewport?.width || 1440;
      posX = (pt.x / docW) * 100;
    }
    if (posY == null || isNaN(posY)) {
      const docH = pt.document?.height || (pt.viewport?.height ? pt.viewport.height * 1.5 : 1200);
      posY = (pt.y / docH) * 100;
    }
    return {
      posX: Math.max(0, Math.min(100, Number(posX))),
      posY: Math.max(0, Math.min(100, Number(posY)))
    };
  };

  // Conceptual Webpage Layout Zones for X-Axis (Horizontal)
  const xZones = [
    { label: "Left Margin", desc: "Left Column & Card 1", percent: 0 },
    { label: "Left Content", desc: "Product 1 (Headphones)", percent: 25 },
    { label: "Center Stage", desc: "Hero CTA & Product 2", percent: 50 },
    { label: "Right Content", desc: "Product 3 (Camera)", percent: 75 },
    { label: "Right Margin", desc: "Right Edge", percent: 100 }
  ];

  // Conceptual Webpage Layout Zones for Y-Axis (Vertical Depth)
  const yZones = [
    { label: "Header", desc: "Navigation & Brand", percent: 0 },
    { label: "Hero Zone", desc: "Above the fold (Primary CTA)", percent: 30 },
    { label: "Products", desc: "Product Cards & Add to Cart", percent: 65 },
    { label: "Page Bottom", desc: "Lower content & Footer", percent: 100 }
  ];

  const handleMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const relY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const percentX = (relX / rect.width) * 100;
    const percentY = (relY / rect.height) * 100;

    // Determine current zone deterministically based on page proportions
    const currentXZone = percentX < 33 ? "Left Column" : percentX < 66 ? "Center Stage" : "Right Column";
    const currentYZone = percentY < 25 ? "Header" : percentY < 55 ? "Hero (Above Fold)" : "Product Grid & Body";

    setCursorPos({
      percentX,
      percentY,
      zone: `${currentXZone} · ${currentYZone}`,
      active: true
    });
  };

  const handleMouseLeave = () => {
    setCursorPos(prev => ({ ...prev, active: false }));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      
      {/* 1. Header Toolbar with Clear Purpose Description */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-500" />
          <span className="font-bold text-slate-800 text-sm">User Engagement & Click Density Map</span>
          <span className="text-slate-400 text-xs hidden sm:inline">
            (Visualizing where visitors interact on this page)
          </span>
        </div>

        {/* Live Zone Readout */}
        <div className="flex items-center gap-3">
          {hoveredPoint ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs text-xs font-semibold animate-in fade-in duration-150">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <strong>Active Click Point:</strong> {
                (() => {
                  const coords = getPointCoords(hoveredPoint);
                  const xZone = coords.posX < 33 ? "Left Card Area" : coords.posX < 66 ? "Center / Hero" : "Right Card Area";
                  const yZone = coords.posY < 25 ? "Top / Header" : coords.posY < 55 ? "Hero Section" : "Products / Footer";
                  return `${xZone} (${yZone}) • ${coords.posX.toFixed(1)}%, ${coords.posY.toFixed(1)}%`;
                })()
              }
            </div>
          ) : cursorPos.active ? (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-xs text-xs">
              <Crosshair className="w-3.5 h-3.5 text-indigo-500" />
              <span>Inspecting Zone:</span> <strong>{cursorPos.zone}</strong>
            </div>
          ) : (
            <div className="text-slate-400 flex items-center gap-1 text-[11px]">
              <HelpCircle className="w-3.5 h-3.5" />
              Hover anywhere on the map to inspect user attention
            </div>
          )}
        </div>
      </div>

      {/* 2. Responsive Canvas Box (Zero scrolling, labeled by webpage sections) */}
      <div className="p-4 bg-slate-900 select-none">
        
        {/* Top Horizontal Layout Zones */}
        <div className="flex items-center justify-between mb-1 ml-28 pr-2">
          <div className="flex-1 flex justify-between text-[11px] font-semibold text-indigo-300">
            <span>&larr; Left Layout (Side & Card 1)</span>
            <span>Center Layout (Hero Banner & Card 2)</span>
            <span>Right Layout (Card 3 & Details) &rarr;</span>
          </div>
        </div>

        <div className="flex items-stretch">
          
          {/* Left Vertical Page Depth Column */}
          <div className="flex items-stretch mr-2 shrink-0">
            {/* Vertical Label Badge */}
            <div
              className="bg-indigo-600 text-white text-[10px] font-bold py-2 px-1 rounded-md shadow-xs tracking-wider uppercase flex items-center justify-center mr-2"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              &larr; Page Depth (Top to Bottom) &rarr;
            </div>

            {/* Left Depth Section Labels */}
            <div className="relative w-24 text-[11px] font-medium text-slate-300 border-r border-slate-700 pr-2">
              {yZones.map((z, idx) => (
                <div
                  key={idx}
                  className="absolute right-2 flex flex-col items-end text-right"
                  style={{
                    top: `${z.percent}%`,
                    transform: idx === 0 ? 'translateY(0)' : idx === yZones.length - 1 ? 'translateY(-100%)' : 'translateY(-50%)'
                  }}
                >
                  <span className="font-bold text-white leading-tight">{z.label}</span>
                  <span className="text-[9px] text-slate-400 leading-tight">{z.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Center Stage: Horizontal Section Ticks + Heatmap Canvas */}
          <div className="flex-1 flex flex-col min-w-0">
            
            {/* Top Layout Section Ticks */}
            <div className="relative h-6 border-b border-slate-700 text-[10px] text-slate-400 mb-1">
              {xZones.map((z, idx) => (
                <div
                  key={idx}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{
                    left: `${z.percent}%`,
                    transform: idx === 0 ? 'translateX(0)' : idx === xZones.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
                  }}
                >
                  <span className="text-slate-300 font-semibold mb-0.5">{z.label}</span>
                  <span className="h-1.5 border-l border-slate-500"></span>
                </div>
              ))}
            </div>

            {/* Main Stage Frame: 420px tall, 100% wide, ZERO SCROLLING */}
            <div
              ref={canvasRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="relative w-full h-[420px] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden cursor-crosshair"
            >
              {/* Layout Zone Background Shading */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(to right, #64748b 1px, transparent 1px), linear-gradient(to bottom, #64748b 1px, transparent 1px)',
                  backgroundSize: '25% 33.3%'
                }}
              />

              {/* Subdued Layout Guides */}
              <div className="absolute top-[28%] left-0 right-0 border-b border-dashed border-slate-700/60 pointer-events-none">
                <span className="text-[10px] text-slate-500 font-mono pl-3">--- Above the fold boundary ---</span>
              </div>
              <div className="absolute top-[65%] left-0 right-0 border-b border-dashed border-slate-700/60 pointer-events-none">
                <span className="text-[10px] text-slate-500 font-mono pl-3">--- Product Cards row ---</span>
              </div>

              {/* Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 bg-slate-950/70 z-30 flex items-center justify-center text-white text-sm">
                  <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl shadow-lg border border-slate-700">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    Loading click density...
                  </div>
                </div>
              )}

              {/* Empty State */}
              {points.length === 0 && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
                  <MousePointer className="w-10 h-10 stroke-[1.5] text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-400">No clicks recorded yet for this URL</p>
                  <p className="text-xs text-slate-600">Open this page in a browser and click to generate points.</p>
                </div>
              )}

              {/* Click Heat Points (Proportional projection across layout) */}
              {points.map((pt, idx) => {
                const { posX, posY } = getPointCoords(pt);

                return (
                  <div
                    key={pt.id || idx}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="absolute cursor-pointer rounded-full transition-transform hover:scale-175 z-10"
                    style={{
                      left: `${posX}%`,
                      top: `${posY}%`,
                      width: `${dotSize}px`,
                      height: `${dotSize}px`,
                      transform: 'translate(-50%, -50%)',
                      background: 'radial-gradient(circle, rgba(244, 63, 94, 0.95) 0%, rgba(245, 158, 11, 0.7) 45%, rgba(234, 179, 8, 0) 100%)',
                      boxShadow: '0 0 14px rgba(244, 63, 94, 0.75)',
                    }}
                    title={`Click at (${pt.x}px, ${pt.y}px) • Normalized: (${posX.toFixed(1)}%, ${posY.toFixed(1)}%)`}
                  />
                );
              })}

              {/* Dynamic Cursor Crosshairs */}
              {cursorPos.active && (
                <>
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none border-l border-dashed border-indigo-400/60 z-20"
                    style={{ left: `${cursorPos.percentX}%` }}
                  />
                  <div
                    className="absolute left-0 right-0 pointer-events-none border-t border-dashed border-indigo-400/60 z-20"
                    style={{ top: `${cursorPos.percentY}%` }}
                  />
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* 3. Heatmap Interpretation Guide Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Interpretation:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-xs"></span>
            <span><strong>Red Center:</strong> High click concentration (Primary user focus)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-xs"></span>
            <span><strong>Yellow Ring:</strong> Secondary interest</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>Dense clusters indicate high user engagement on buttons & links.</span>
        </div>
      </div>

    </div>
  );
}
