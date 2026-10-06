import React, { useState } from 'react';
import {
  History,
  ChevronDown,
  Calendar,
  TrendingUp,
  Activity,
  Layers,
  Clock,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  formatSat,
  formatVsize,
  formatFeerate
} from '../utils/calculations';

// Custom Tooltip for Historical Charts
function HistoryTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-md text-xs">
        <p className="font-bold text-slate-800 mb-1">{data.name}</p>
        {data.snapshot_time && (
          <p className="text-[10px] text-slate-400 mb-2">
            {new Date(data.snapshot_time).toLocaleString()}
          </p>
        )}
        <div className="space-y-1 text-slate-600">
          <div className="flex items-center justify-between gap-4">
            <span>Transactions:</span>
            <span className="font-mono font-bold text-slate-900">{data.transaction_count}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Total vsize:</span>
            <span className="font-mono">{formatVsize(data.total_vsize)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Avg Feerate:</span>
            <span className="font-mono text-[#f7931a] font-bold">
              {formatFeerate(data.avg_feerate_sat_vb)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function SnapshotSelector({
  historyData = [],
  currentSnapshotId,
  onSelectSnapshot,
}) {
  const [activeTab, setActiveTab] = useState('count');

  // Format data for Recharts
  const chartData = (historyData || []).map((item) => ({
    name: item.name || `Snapshot ${item.id}`,
    id: item.id,
    snapshot_time: item.snapshot_time,
    transaction_count: Number(item.transaction_count) || 0,
    total_vsize: Number(item.total_vsize) || 0,
    avg_feerate_sat_vb: Number(item.avg_feerate_sat_vb) || 0,
    total_fee_sat: Number(item.total_fee_sat) || 0,
  }));

  const hasMultipleSnapshots = chartData.length > 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header and Snapshot Dropdown */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-4 h-4 text-[#f7931a]" />
            Historical Mempool Snapshots
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Temporal telemetry collected across Bitcoin Core regtest state intervals
          </p>
        </div>

        {/* Dropdown Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="snapshot-select" className="text-xs text-slate-500 font-medium">
            Active Snapshot:
          </label>
          <div className="relative inline-block">
            <select
              id="snapshot-select"
              value={currentSnapshotId || ''}
              onChange={(e) => {
                const selected = historyData.find((h) => h.id === e.target.value);
                if (selected) onSelectSnapshot(selected);
              }}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-[#f7931a] cursor-pointer"
            >
              {historyData.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {s.name} {idx === historyData.length - 1 ? '(Latest)' : ''} — {s.transaction_count} txs
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="p-5">
        {!hasMultipleSnapshots ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">
              Single Snapshot Mode Active
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
              Only one snapshot ({chartData[0]?.name || 'Snapshot 001'}) is currently recorded. At least two snapshots are required to plot trend progression lines.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Metric Chart Toggle Tabs */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActiveTab('count')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'count'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Transaction Count
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('vsize')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'vsize'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Total Virtual Size (vB)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('feerate')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === 'feerate'
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Average Feerate (sat/vB)
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                {chartData.length} sequential snapshots
              </span>
            </div>

            {/* Recharts Line Display */}
            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<HistoryTooltip />} />

                  {activeTab === 'count' && (
                    <Line
                      type="monotone"
                      dataKey="transaction_count"
                      name="Transactions"
                      stroke="#f7931a"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#f7931a', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#e08213' }}
                    />
                  )}

                  {activeTab === 'vsize' && (
                    <Line
                      type="monotone"
                      dataKey="total_vsize"
                      name="Virtual Size (vB)"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#0284c7', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#0369a1' }}
                    />
                  )}

                  {activeTab === 'feerate' && (
                    <Line
                      type="monotone"
                      dataKey="avg_feerate_sat_vb"
                      name="Average Feerate"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#059669' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
