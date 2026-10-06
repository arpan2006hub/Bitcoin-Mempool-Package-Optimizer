import React, { useState, useMemo } from 'react';
import {
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Scale,
  Database,
  TrendingUp,
  Copy,
  Check,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  formatSat,
  formatBtc,
  formatVsize,
  formatFeerate,
  formatPercent,
  truncateTxid
} from '../utils/calculations';

export default function SimulationResult({ simulationData, comparisonData }) {
  const [selectedAlgo, setSelectedAlgo] = useState('optimizer');
  const [copiedTxid, setCopiedTxid] = useState(null);

  // Normalize simulation data for each algorithm
  const simMap = useMemo(() => {
    const map = {};

    // 1. From simulationData
    if (simulationData) {
      if (simulationData.optimizer) map.optimizer = simulationData.optimizer;
      if (simulationData.baseline) map.baseline = simulationData.baseline;
      if (simulationData.improved) map.improved = simulationData.improved;
    }

    // 2. From comparisonData if available
    if (Array.isArray(comparisonData)) {
      comparisonData.forEach((item) => {
        if (item.algorithm === 'ancestor_package' || item.algorithm === 'optimizer') {
          if (!map.optimizer) map.optimizer = item;
        } else if (item.algorithm === 'baseline') {
          if (!map.baseline) map.baseline = item;
        } else if (item.algorithm === 'improved') {
          if (!map.improved) map.improved = item;
        }
      });
    }

    return map;
  }, [simulationData, comparisonData]);

  const activeAlgoKeys = Object.keys(simMap);
  const currentKey = simMap[selectedAlgo] ? selectedAlgo : (activeAlgoKeys[0] || 'optimizer');
  const sim = simMap[currentKey];

  const copyTxid = (txid) => {
    navigator.clipboard.writeText(txid);
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2000);
  };

  if (!sim) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
        <Cpu className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-700">Block Simulation</h3>
        <p className="text-xs text-slate-400 mt-1">
          No simulation results available. Run python -m src.simulator to test block assembly.
        </p>
      </div>
    );
  }

  const maxWeight = sim.max_block_weight || 4_000_000;
  const totalWeight = sim.total_weight || 0;
  const utilizationPercent = sim.block_weight_utilization_percent !== undefined
    ? sim.block_weight_utilization_percent
    : (sim.block_weight_utilization ? sim.block_weight_utilization * 100 : (totalWeight / maxWeight) * 100);

  const includedTxs = sim.included_transactions || [];
  const skippedTxs = sim.skipped_transactions || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header and Algorithm Switcher */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#f7931a]" />
            Block Assembly Simulation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verification of transaction ordering against standard consensus limits (MAX_BLOCK_WEIGHT: {maxWeight.toLocaleString()} WU)
          </p>
        </div>

        {/* Algorithm Tabs */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium self-start sm:self-auto">
          {simMap.optimizer && (
            <button
              type="button"
              onClick={() => setSelectedAlgo('optimizer')}
              className={`px-3 py-1 rounded-md transition-all ${
                currentKey === 'optimizer'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Package Optimizer
            </button>
          )}
          {simMap.baseline && (
            <button
              type="button"
              onClick={() => setSelectedAlgo('baseline')}
              className={`px-3 py-1 rounded-md transition-all ${
                currentKey === 'baseline'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baseline
            </button>
          )}
          {simMap.improved && (
            <button
              type="button"
              onClick={() => setSelectedAlgo('improved')}
              className={`px-3 py-1 rounded-md transition-all ${
                currentKey === 'improved'
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Improved
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Block Capacity Utilization Progress Bar */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#f7931a]" />
              Block Weight Utilization
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-bold text-slate-900">
                {totalWeight.toLocaleString()} <span className="text-slate-400 font-normal">/ {maxWeight.toLocaleString()} WU</span>
              </span>
              <span className="text-xs font-bold text-[#f7931a]">
                ({utilizationPercent.toFixed(4)}%)
              </span>
            </div>
          </div>

          {/* Progress bar track */}
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-[#f7931a] to-[#d97706] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(1, utilizationPercent))}%` }}
              role="progressbar"
              aria-valuenow={utilizationPercent}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
            <span>0 WU</span>
            <span>2,000,000 WU</span>
            <span>4,000,000 WU (Consensus Max)</span>
          </div>
        </div>

        {/* Primary Simulation Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-medium">Selected Virtual Size</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
              {formatVsize(sim.total_vsize || 0)}
            </span>
            <span className="text-[10px] text-slate-400">
              {totalWeight.toLocaleString()} WU
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-medium">Total Fees Captured</span>
            <span className="text-base font-bold text-slate-900 mt-0.5 block font-mono">
              {formatSat(sim.total_fee_sat || 0)}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatBtc(sim.total_fee_sat || 0)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-medium">Effective Feerate</span>
            <span className="text-base font-bold text-[#f7931a] mt-0.5 block font-mono">
              {formatFeerate(sim.effective_feerate_sat_vb || 0)}
            </span>
            <span className="text-[10px] text-slate-400">
              Weighted package rate
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-400 block font-medium">Assembly Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-bold text-emerald-700">
                {includedTxs.length} included
              </span>
              {skippedTxs.length > 0 && (
                <span className="text-amber-700 font-semibold text-[11px]">
                  · {skippedTxs.length} skipped
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              Topologically sorted
            </span>
          </div>
        </div>

        {/* Included Transactions List */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Included Transactions ({includedTxs.length})
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              Ordered as placed into block template
            </span>
          </div>

          {includedTxs.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
              No transactions included in block.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {includedTxs.map((txid, idx) => (
                <div
                  key={txid}
                  className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-slate-800 font-semibold truncate select-all">
                      {txid}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyTxid(txid)}
                    className="text-slate-400 hover:text-slate-700 ml-2 p-1 transition-colors"
                    title="Copy full TXID"
                  >
                    {copiedTxid === txid ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skipped Transactions List (if any) */}
        {skippedTxs.length > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800 mb-2">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Skipped Transactions ({skippedTxs.length})
              </span>
              <span className="text-[10px] text-amber-700 font-normal">
                Excluded due to block capacity or dependency constraints
              </span>
            </div>

            <div className="space-y-1.5">
              {skippedTxs.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-amber-50/50 px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono text-slate-800"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-amber-800 font-bold">#{idx + 1}</span>
                    <span className="truncate select-all">{item.txid}</span>
                  </div>
                  <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium shrink-0 ml-2">
                    {item.reason || 'exceeded limit'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
