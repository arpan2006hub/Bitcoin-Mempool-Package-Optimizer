import React, { useState, useMemo } from 'react';
import {
  Boxes,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import {
  formatSat,
  formatVsize,
  formatFeerate,
  truncateTxid
} from '../utils/calculations';

export default function PackageTable({ packagesData, analysis }) {
  const [sortField, setSortField] = useState('package_feerate_sat_vb');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedPackage, setExpandedPackage] = useState(null);
  const [copiedTxid, setCopiedTxid] = useState(null);

  // Normalize package items from either packagesData or analysis
  const packageList = useMemo(() => {
    if (packagesData && Object.keys(packagesData).length > 0) {
      return Object.entries(packagesData).map(([txid, pkg], idx) => ({
        id: `P${idx + 1}`,
        candidate_txid: txid,
        transactions: pkg.transactions || [txid],
        transaction_count: pkg.transaction_count || (pkg.transactions ? pkg.transactions.length : 1),
        total_fee_sat: pkg.total_fee_sat || 0,
        total_vsize: pkg.total_vsize || 0,
        package_feerate_sat_vb: pkg.package_feerate_sat_vb || 0,
        dependency_depth: pkg.dependency_depth || 0,
      }));
    }

    // Fallback: derive from analysis
    if (analysis && analysis.transactions) {
      return Object.entries(analysis.transactions).map(([txid, tx], idx) => ({
        id: `P${idx + 1}`,
        candidate_txid: txid,
        transactions: tx.depends ? [...tx.depends, txid] : [txid],
        transaction_count: tx.ancestor_count || 1,
        total_fee_sat: tx.package_fee_sat || tx.fee_sat || 0,
        total_vsize: tx.package_vsize || tx.vsize || 0,
        package_feerate_sat_vb: tx.package_feerate_sat_vb || tx.feerate_sat_vb || 0,
        dependency_depth: (tx.ancestor_count || 1) - 1,
      }));
    }

    return [];
  }, [packagesData, analysis]);

  // Sort package list
  const sortedPackages = useMemo(() => {
    return [...packageList].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
  }, [packageList, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleExpand = (id) => {
    setExpandedPackage(expandedPackage === id ? null : id);
  };

  const copyTxid = (txid) => {
    navigator.clipboard.writeText(txid);
    setCopiedTxid(txid);
    setTimeout(() => setCopiedTxid(null), 2000);
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 ml-1 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#f7931a] ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#f7931a] ml-1 inline" />
    );
  };

  if (packageList.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-xs">
        <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-700">Package Analysis</h3>
        <p className="text-xs text-slate-400 mt-1">No transaction packages constructed yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#f7931a]" />
            Ancestor Package Analysis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atomic transaction packages containing the candidate and all required ancestors
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-orange-50 text-orange-800 border border-orange-200 self-start sm:self-auto">
          {packageList.length} candidate packages
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th scope="col" className="py-3 px-4 w-10"></th>
              <th scope="col" className="py-3 px-4">
                Package / Candidate
              </th>
              <th scope="col" className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort('transaction_count')}>
                <div className="flex items-center">
                  <span>Transactions</span>
                  {getSortIcon('transaction_count')}
                </div>
              </th>
              <th scope="col" className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort('total_vsize')}>
                <div className="flex items-center">
                  <span>vsize</span>
                  {getSortIcon('total_vsize')}
                </div>
              </th>
              <th scope="col" className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort('total_fee_sat')}>
                <div className="flex items-center">
                  <span>Fee</span>
                  {getSortIcon('total_fee_sat')}
                </div>
              </th>
              <th scope="col" className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort('package_feerate_sat_vb')}>
                <div className="flex items-center">
                  <span>Package Feerate</span>
                  {getSortIcon('package_feerate_sat_vb')}
                </div>
              </th>
              <th scope="col" className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort('dependency_depth')}>
                <div className="flex items-center">
                  <span>Depth</span>
                  {getSortIcon('dependency_depth')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {sortedPackages.map((pkg) => {
              const isExpanded = expandedPackage === pkg.id;
              return (
                <React.Fragment key={pkg.id}>
                  <tr
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                      isExpanded ? 'bg-orange-50/40' : ''
                    }`}
                    onClick={() => toggleExpand(pkg.id)}
                  >
                    <td className="py-3 px-3 text-center text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#f7931a]" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {pkg.id}
                        </span>
                        <span className="font-mono text-xs text-slate-600">
                          {truncateTxid(pkg.candidate_txid, 10)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                        {pkg.transaction_count}
                        <span className="text-[11px] font-normal text-slate-400">txs</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {formatVsize(pkg.total_vsize)}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {formatSat(pkg.total_fee_sat)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#f7931a] bg-orange-50 px-2 py-0.5 rounded border border-orange-100 font-mono">
                        {formatFeerate(pkg.package_feerate_sat_vb)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {pkg.dependency_depth}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded detail row showing all transactions inside this ancestor package */}
                  {isExpanded && (
                    <tr className="bg-orange-50/20">
                      <td colSpan="7" className="py-3 px-8 border-b border-orange-100">
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-[#f7931a]" />
                              Constituent Transactions ({pkg.transactions.length}):
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Must be confirmed in topological order
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {pkg.transactions.map((txid, idx) => (
                              <div
                                key={txid}
                                className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-mono"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                                  <span className="text-slate-800 truncate select-all">{txid}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyTxid(txid);
                                  }}
                                  className="text-slate-400 hover:text-slate-700 ml-2 p-1"
                                  title="Copy TXID"
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
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
