import React, { useState } from 'react';
import { useHeatmap } from '../hooks/useHeatmap';
import HeatmapControls from './heatmap/HeatmapControls';
import HeatmapCanvas from './heatmap/HeatmapCanvas';

export default function HeatmapView() {
  const [dotSize, setDotSize] = useState(24);
  const {
    pages,
    selectedUrl,
    setSelectedUrl,
    clickData,
    loadingPages,
    loadingClicks,
    error,
    refetchClicks,
    refetchPages
  } = useHeatmap();

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Controls */}
      <HeatmapControls
        pages={pages}
        selectedUrl={selectedUrl}
        onSelectUrl={setSelectedUrl}
        totalClicks={clickData?.total_clicks}
        dotSize={dotSize}
        onChangeDotSize={setDotSize}
        loadingPages={loadingPages}
        loadingClicks={loadingClicks}
        onRefresh={() => { refetchPages(); refetchClicks(); }}
      />

      {/* Canvas */}
      <HeatmapCanvas
        points={clickData?.points}
        dotSize={dotSize}
        loading={loadingClicks}
      />
    </div>
  );
}
