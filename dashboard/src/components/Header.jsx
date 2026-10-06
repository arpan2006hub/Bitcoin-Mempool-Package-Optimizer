import React from 'react';
import { RefreshCw, Play, CircleDot, Layers } from 'lucide-react';
import NetworkSelector from './NetworkSelector';

export default function Header({
  selectedNetwork,
  onSelectNetwork,
  onRefresh,
  onRunAnalysis,
  isRefreshing,
  isAnalyzing,
  lastUpdated,
}) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f7931a] to-[#d97706] flex items-center justify-center text-white shadow-xs shrink-0">
              <span className="font-bold text-xl leading-none tracking-tight">₿</span>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Bitcoin Mempool Package Optimizer
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Snapshot mode
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Experimental dependency-aware transaction selection & research interface
              </p>
            </div>
          </div>

          {/* Controls: Network Selector & Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
              <span className="hidden lg:inline text-slate-400">Network:</span>
              <NetworkSelector
                selectedNetwork={selectedNetwork}
                onSelectNetwork={onSelectNetwork}
              />
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh mempool snapshot and analysis data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-lg shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-[#f7931a]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
              aria-label="Trigger mempool analysis pipeline"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#f7931a] hover:bg-[#e08213] active:bg-[#c9740f] rounded-lg shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isAnalyzing ? 'animate-pulse' : ''}`} />
              <span>{isAnalyzing ? 'Analyzing...' : 'Run Analysis'}</span>
            </button>
          </div>
        </div>

        {lastUpdated && (
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <CircleDot className="w-3 h-3 text-[#f7931a]" />
              Data Source: JSON-RPC Snapshot Pipeline
            </span>
            <span>Last synchronized: {new Date(lastUpdated).toLocaleString()}</span>
          </div>
        )}
      </div>
    </header>
  );
}
