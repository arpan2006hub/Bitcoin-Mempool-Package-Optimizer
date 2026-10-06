import React from 'react';
import {
  Layers,
  Database,
  GitBranch,
  TrendingUp,
  Scale,
  Hash,
  ArrowDownRight,
  Boxes
} from 'lucide-react';
import {
  calculateTotalFees,
  calculateTotalVsize,
  calculateAverageFeerate,
  calculateDependencyDepth,
  formatSat,
  formatBtc,
  formatVsize,
  formatFeerate
} from '../utils/calculations';

export default function MempoolOverview({ analysis, snapshot }) {
  const transactions = analysis?.transactions || snapshot?.transactions || {};
  const txList = Object.values(transactions);
  const txCount = txList.length;

  if (txCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs text-center">
        <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-700">Mempool Overview</h3>
        <p className="text-xs text-slate-400 mt-1">No analysis snapshot available.</p>
      </div>
    );
  }

  // Aggregate metrics
  const totalFees = calculateTotalFees(transactions);
  const totalVsize = calculateTotalVsize(transactions);
  const totalWeight = txList.reduce((acc, tx) => acc + (Number(tx.weight) || (Number(tx.vsize) * 4) || 0), 0);
  const averageFeerate = calculateAverageFeerate(totalFees, totalVsize);
  const maxDepth = calculateDependencyDepth(transactions);

  // Root vs Dependent transactions
  let rootCount = 0;
  let dependentCount = 0;

  for (const tx of txList) {
    const depends = tx.depends || [];
    if (depends.length === 0) {
      rootCount++;
    } else {
      dependentCount++;
    }
  }

  const items = [
    {
      label: 'Transaction Count',
      value: txCount.toLocaleString(),
      sub: `${rootCount} roots, ${dependentCount} dependent`,
      icon: Hash,
    },
    {
      label: 'Total Virtual Size',
      value: formatVsize(totalVsize),
      sub: `${totalWeight.toLocaleString()} WU`,
      icon: Scale,
    },
    {
      label: 'Total Fees',
      value: formatSat(totalFees),
      sub: formatBtc(totalFees),
      icon: Database,
    },
    {
      label: 'Average Feerate',
      value: formatFeerate(averageFeerate),
      sub: 'fee / vsize',
      icon: TrendingUp,
    },
    {
      label: 'Max Dependency Depth',
      value: maxDepth.toString(),
      sub: maxDepth === 0 ? 'No child chains' : `${maxDepth} sequential levels`,
      icon: GitBranch,
    },
    {
      label: 'Root Transactions',
      value: rootCount.toString(),
      sub: 'Zero mempool parents',
      icon: Boxes,
    },
    {
      label: 'Dependent Transactions',
      value: dependentCount.toString(),
      sub: 'Spend unconfirmed UTXOs',
      icon: ArrowDownRight,
    },
    {
      label: 'Total Weight Units',
      value: `${totalWeight.toLocaleString()} WU`,
      sub: `${(totalWeight / 4_000_000 * 100).toFixed(4)}% of 4M WU block`,
      icon: Layers,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#f7931a]" />
            Mempool Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aggregated structural and financial telemetry from the active snapshot
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
          {txCount} transactions analyzed
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        {items.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-400">
                <Icon className="w-3.5 h-3.5 text-[#f7931a]" />
                <span className="text-[11px] font-medium text-slate-600 truncate">
                  {item.label}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900 mt-1.5 truncate">
                {item.value}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate font-medium">
                {item.sub}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
