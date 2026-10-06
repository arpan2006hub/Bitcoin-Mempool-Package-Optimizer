import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { formatSat, formatFeerate } from '../utils/calculations';

// Custom Tooltip for Fee Chart
function FeeCustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs">
        <p className="font-bold text-slate-800 mb-1">{data.name}</p>
        <div className="flex items-center justify-between gap-4 text-slate-600">
          <span>Total Fee:</span>
          <span className="font-mono font-bold text-slate-900">{formatSat(data.feeSat)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-500 text-[10px] mt-0.5">
          <span>Virtual Size:</span>
          <span className="font-mono">{data.vsize} vB</span>
        </div>
      </div>
    );
  }
  return null;
}

// Custom Tooltip for Feerate Chart
function FeerateCustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs">
        <p className="font-bold text-slate-800 mb-1">{data.name}</p>
        <div className="flex items-center justify-between gap-4 text-slate-600">
          <span>Effective Feerate:</span>
          <span className="font-mono font-bold text-[#f7931a]">
            {formatFeerate(data.feerate)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-500 text-[10px] mt-0.5">
          <span>Block Weight:</span>
          <span className="font-mono">{data.weight.toLocaleString()} WU</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function OptimizationChart({
  comparisonData,
  baselineResult,
  optimizerResult,
  improvedResult,
}) {
  // Prepare chart dataset with neutral labels
  const data = React.useMemo(() => {
    let base = null;
    let pkg = null;
    let imp = null;

    if (Array.isArray(comparisonData)) {
      base = comparisonData.find((item) => item.algorithm === 'baseline');
      pkg = comparisonData.find(
        (item) => item.algorithm === 'ancestor_package' || item.algorithm === 'optimizer'
      );
      imp = comparisonData.find((item) => item.algorithm === 'improved');
    }

    const parseMetrics = (simItem, rawItem, label, shortName) => {
      const combined = { ...(rawItem || {}), ...(simItem || {}) };
      const feeSat = Number(combined.total_fee_sat) || 0;
      const vsize = Number(combined.total_vsize) || 1;
      const weight = Number(combined.total_weight) || (vsize * 4);
      const feerate = combined.effective_feerate_sat_vb !== undefined
        ? Number(combined.effective_feerate_sat_vb)
        : feeSat / vsize;

      return {
        name: label,
        shortName,
        feeSat,
        vsize,
        weight,
        feerate: Number(feerate.toFixed(2)),
      };
    };

    return [
      parseMetrics(base, baselineResult, '1. Baseline (Naive)', 'Baseline'),
      parseMetrics(pkg, optimizerResult, '2. Dependency-aware Package', 'Package'),
      parseMetrics(imp, improvedResult, '3. Improved Heuristic', 'Improved'),
    ];
  }, [comparisonData, baselineResult, optimizerResult, improvedResult]);

  const colors = ['#64748b', '#f7931a', '#d97706'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Chart 1: Total Selected Fees */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#f7931a]" />
              Total Selected Fees
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative transaction fees selected within block limit (satoshis)
            </p>
          </div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Neutral Comparison
          </span>
        </div>

        <div className="h-64 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="shortName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
              />
              <Tooltip content={<FeeCustomTooltip />} />
              <Bar dataKey="feeSat" radius={[6, 6, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-fee-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Effective Feerate */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#f7931a]" />
              Effective Feerate
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aggregate feerate across included transactions (sat/vB)
            </p>
          </div>
          <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
            Neutral Comparison
          </span>
        </div>

        <div className="h-64 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="shortName"
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${val}`}
              />
              <Tooltip content={<FeerateCustomTooltip />} />
              <Bar dataKey="feerate" radius={[6, 6, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-feerate-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
