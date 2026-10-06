import React, { useMemo } from 'react';
import {
  Scale,
  TrendingUp,
  Percent,
  PlusCircle,
  MinusCircle,
  HelpCircle,
  Info
} from 'lucide-react';
import {
  formatSat,
  formatVsize,
  formatFeerate,
  formatPercent,
  calculateImprovement
} from '../utils/calculations';

export default function AlgorithmComparison({
  comparisonData,
  baselineResult,
  optimizerResult,
  improvedResult,
}) {
  // Normalize metrics for all three algorithms
  const { baseline, packageOpt, improved, hasData } = useMemo(() => {
    let base = null;
    let pkg = null;
    let imp = null;

    // Check if comparisonData array is available
    if (Array.isArray(comparisonData) && comparisonData.length > 0) {
      base = comparisonData.find((item) => item.algorithm === 'baseline');
      pkg = comparisonData.find(
        (item) => item.algorithm === 'ancestor_package' || item.algorithm === 'optimizer'
      );
      imp = comparisonData.find((item) => item.algorithm === 'improved');
    }

    // Merge/fallback with individual result files
    const parseAlgo = (simItem, rawItem, name) => {
      if (!simItem && !rawItem) return null;
      const combined = { ...(rawItem || {}), ...(simItem || {}) };

      const txCount =
        combined.included_transaction_count ??
        combined.transactions_selected ??
        combined.transaction_count ??
        (Array.isArray(combined.selected_transactions) ? combined.selected_transactions.length : 0);

      const feeSat = Number(combined.total_fee_sat) || 0;
      const vsize = Number(combined.total_vsize) || 0;
      const weight = Number(combined.total_weight) || (vsize * 4);
      const feerate = combined.effective_feerate_sat_vb !== undefined
        ? Number(combined.effective_feerate_sat_vb)
        : (vsize > 0 ? feeSat / vsize : 0);

      const utilization = combined.block_weight_utilization_percent !== undefined
        ? Number(combined.block_weight_utilization_percent)
        : (combined.block_utilization ? combined.block_utilization * 100 : (weight / 4_000_000) * 100);

      return {
        name,
        transactionCount: txCount,
        totalFeeSat: feeSat,
        totalVsize: vsize,
        totalWeight: weight,
        effectiveFeerate: feerate,
        blockUtilizationPercent: utilization,
        runtime: combined.runtime !== undefined ? `${combined.runtime} ms` : 'N/A',
      };
    };

    const b = parseAlgo(base, baselineResult, 'Baseline (Naive Feerate)');
    const p = parseAlgo(pkg, optimizerResult, 'Dependency-Aware Package');
    const i = parseAlgo(imp, improvedResult, 'Improved Heuristic');

    return {
      baseline: b,
      packageOpt: p,
      improved: i,
      hasData: Boolean(b || p || i),
    };
  }, [comparisonData, baselineResult, optimizerResult, improvedResult]);

  if (!hasData) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
        <Scale className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-700">Algorithm Comparison</h3>
        <p className="text-xs text-slate-400 mt-1">
          Run the comparison pipeline to populate this section.
        </p>
      </div>
    );
  }

  // Calculate improvement relative to baseline
  const baseFee = baseline?.totalFeeSat || 0;
  const packageFee = packageOpt?.totalFeeSat || 0;
  const improvedFee = improved?.totalFeeSat || 0;

  const packageDiff = calculateImprovement(packageFee, baseFee);
  const improvedDiff = calculateImprovement(improvedFee, baseFee);

  const rows = [
    {
      metric: 'Selected transactions',
      baseline: baseline?.transactionCount ?? 'N/A',
      package: packageOpt?.transactionCount ?? 'N/A',
      improved: improved?.transactionCount ?? 'N/A',
    },
    {
      metric: 'Total fee',
      baseline: baseline ? formatSat(baseline.totalFeeSat) : 'N/A',
      package: packageOpt ? formatSat(packageOpt.totalFeeSat) : 'N/A',
      improved: improved ? formatSat(improved.totalFeeSat) : 'N/A',
      highlight: true,
    },
    {
      metric: 'Total vsize',
      baseline: baseline ? formatVsize(baseline.totalVsize) : 'N/A',
      package: packageOpt ? formatVsize(packageOpt.totalVsize) : 'N/A',
      improved: improved ? formatVsize(improved.totalVsize) : 'N/A',
    },
    {
      metric: 'Total weight',
      baseline: baseline ? `${baseline.totalWeight.toLocaleString()} WU` : 'N/A',
      package: packageOpt ? `${packageOpt.totalWeight.toLocaleString()} WU` : 'N/A',
      improved: improved ? `${improved.totalWeight.toLocaleString()} WU` : 'N/A',
    },
    {
      metric: 'Effective feerate',
      baseline: baseline ? formatFeerate(baseline.effectiveFeerate) : 'N/A',
      package: packageOpt ? formatFeerate(packageOpt.effectiveFeerate) : 'N/A',
      improved: improved ? formatFeerate(improved.effectiveFeerate) : 'N/A',
      highlight: true,
    },
    {
      metric: 'Block utilization',
      baseline: baseline ? formatPercent(baseline.blockUtilizationPercent) : 'N/A',
      package: packageOpt ? formatPercent(packageOpt.blockUtilizationPercent) : 'N/A',
      improved: improved ? formatPercent(improved.blockUtilizationPercent) : 'N/A',
    },
    {
      metric: 'Runtime',
      baseline: baseline?.runtime || 'N/A',
      package: packageOpt?.runtime || 'N/A',
      improved: improved?.runtime || 'N/A',
      subtext: 'Execution time if benchmarked',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#f7931a]" />
            Algorithm Comparison
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Side-by-side evaluation of block-selection algorithms under identical mempool constraints
          </p>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th scope="col" className="py-3 px-5 w-1/4">
                Metric
              </th>
              <th scope="col" className="py-3 px-4 w-1/4">
                <span className="text-slate-800">1. Baseline</span>
                <span className="block text-[10px] text-slate-400 font-normal lowercase">
                  naive fee-rate
                </span>
              </th>
              <th scope="col" className="py-3 px-4 w-1/4">
                <span className="text-orange-950">2. Dependency-aware Package</span>
                <span className="block text-[10px] text-[#f7931a] font-normal lowercase">
                  package feerate
                </span>
              </th>
              <th scope="col" className="py-3 px-4 w-1/4">
                <span className="text-slate-800">3. Improved</span>
                <span className="block text-[10px] text-slate-400 font-normal lowercase">
                  depth & child heuristic
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={`hover:bg-slate-50 transition-colors ${
                  row.highlight ? 'bg-orange-50/20' : ''
                }`}
              >
                <td className="py-3 px-5 text-slate-900 font-semibold text-xs">
                  {row.metric}
                  {row.subtext && (
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {row.subtext}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono">{row.baseline}</td>
                <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                  {row.package}
                </td>
                <td className="py-3 px-4 font-mono">{row.improved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Difference Relative to Baseline Cards */}
      <div className="p-5 bg-slate-50 border-t border-slate-200">
        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Difference Relative to Baseline</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Package Optimizer Relative Diff */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Package Optimizer vs Baseline
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                Research Metric
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Fee Difference</span>
                <span className={`text-base font-bold font-mono ${
                  packageDiff.feeDifference > 0 ? 'text-emerald-600' : 'text-slate-800'
                }`}>
                  {packageDiff.feeDifference > 0 ? `+${packageDiff.feeDifference.toLocaleString()}` : packageDiff.feeDifference.toLocaleString()} sat
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Relative Difference</span>
                <span className={`text-base font-bold font-mono ${
                  (packageDiff.relativeDifference || 0) > 0 ? 'text-emerald-600' : 'text-slate-800'
                }`}>
                  {packageDiff.relativeDifference !== null
                    ? `${packageDiff.relativeDifference > 0 ? '+' : ''}${packageDiff.relativeDifference}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Calculated as ((optimizer_fee - baseline_fee) / baseline_fee) * 100
            </p>
          </div>

          {/* Improved Optimizer Relative Diff */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Improved Heuristic vs Baseline
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                Experimental
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Fee Difference</span>
                <span className={`text-base font-bold font-mono ${
                  improvedDiff.feeDifference > 0 ? 'text-emerald-600' : 'text-slate-800'
                }`}>
                  {improvedDiff.feeDifference > 0 ? `+${improvedDiff.feeDifference.toLocaleString()}` : improvedDiff.feeDifference.toLocaleString()} sat
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Relative Difference</span>
                <span className={`text-base font-bold font-mono ${
                  (improvedDiff.relativeDifference || 0) > 0 ? 'text-emerald-600' : 'text-slate-800'
                }`}>
                  {improvedDiff.relativeDifference !== null
                    ? `${improvedDiff.relativeDifference > 0 ? '+' : ''}${improvedDiff.relativeDifference}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Incorporates future child potential and depth penalty factors
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
