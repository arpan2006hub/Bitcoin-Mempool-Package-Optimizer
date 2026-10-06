import React, { useState, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Network,
  Maximize2,
  Copy,
  Check,
  X,
  ArrowRight,
  Info,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  truncateTxid,
  formatSat,
  formatBtc,
  formatVsize,
  formatFeerate
} from '../utils/calculations';

// Custom Node for React Flow
function TransactionNode({ data, selected }) {
  const isRoot = !data.parents || data.parents.length === 0;
  const isLeaf = !data.children || data.children.length === 0;

  return (
    <div
      className={`px-3 py-2.5 rounded-xl border transition-all text-left bg-white min-w-[170px] shadow-xs ${
        selected
          ? 'border-[#f7931a] ring-2 ring-orange-200 shadow-md'
          : 'border-slate-200 hover:border-orange-300'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 bg-[#f7931a] border-2 border-white"
      />

      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-mono text-xs font-bold text-slate-800">
          {truncateTxid(data.txid, 8)}
        </span>
        <span
          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
            isRoot
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-orange-50 text-[#f7931a] border border-orange-200'
          }`}
        >
          {isRoot ? 'Root' : 'Child'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 border-t border-slate-100">
        <div>
          <span className="text-[10px] text-slate-400 block">Feerate</span>
          <span className="font-semibold text-slate-700">
            {data.feerate.toFixed(1)} <span className="text-[9px] font-normal text-slate-400">s/vB</span>
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">vsize</span>
          <span className="font-semibold text-slate-700">{data.vsize} vB</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 bg-[#f7931a] border-2 border-white"
      />
    </div>
  );
}

const nodeTypes = {
  transactionNode: TransactionNode,
};

export default function DependencyGraph({ analysis, graphData }) {
  const [selectedTx, setSelectedTx] = useState(null);
  const [copiedTxid, setCopiedTxid] = useState(false);

  // Build DAG layout from analysis data
  const { nodes, edges, rawTxMap } = useMemo(() => {
    const txMap = analysis?.transactions || {};
    const txids = Object.keys(txMap);

    if (txids.length === 0) {
      return { nodes: [], edges: [], rawTxMap: {} };
    }

    // Compute topological level for node positioning (parent at top, child below)
    const levelMap = {};
    const getLevel = (txid, visited = new Set()) => {
      if (visited.has(txid)) return 0;
      if (levelMap[txid] !== undefined) return levelMap[txid];

      const tx = txMap[txid];
      const parents = tx?.depends || [];
      if (!parents.length) {
        levelMap[txid] = 0;
        return 0;
      }

      visited.add(txid);
      let maxP = 0;
      for (const p of parents) {
        if (txMap[p]) {
          maxP = Math.max(maxP, getLevel(p, new Set(visited)) + 1);
        }
      }
      visited.delete(txid);

      levelMap[txid] = maxP;
      return maxP;
    };

    txids.forEach((id) => getLevel(id));

    // Group nodes by level to assign horizontal coordinates
    const levelGroups = {};
    txids.forEach((id) => {
      const lvl = levelMap[id] || 0;
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(id);
    });

    const flowNodes = [];
    const flowEdges = [];
    const HORIZONTAL_SPACING = 210;
    const VERTICAL_SPACING = 130;

    Object.entries(levelGroups).forEach(([levelStr, group]) => {
      const lvl = Number(levelStr);
      const totalWidth = (group.length - 1) * HORIZONTAL_SPACING;
      const startX = -totalWidth / 2;

      group.forEach((txid, idx) => {
        const tx = txMap[txid];
        const feeSat = tx.fee_sat || (tx.fees?.base ? Math.round(tx.fees.base * 100_000_000) : 0);
        const vsize = Number(tx.vsize) || 1;
        const feerate = tx.feerate_sat_vb !== undefined ? Number(tx.feerate_sat_vb) : feeSat / vsize;

        flowNodes.push({
          id: txid,
          type: 'transactionNode',
          position: {
            x: startX + idx * HORIZONTAL_SPACING + 250,
            y: lvl * VERTICAL_SPACING + 40,
          },
          data: {
            txid,
            feerate,
            vsize,
            feeSat,
            parents: tx.depends || [],
            children: tx.spent_by || tx.spentby || [],
          },
        });

        // Create edges: Parent -> Child
        (tx.depends || []).forEach((parentTxid) => {
          if (txMap[parentTxid]) {
            flowEdges.push({
              id: `${parentTxid}->${txid}`,
              source: parentTxid,
              target: txid,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#f7931a', strokeWidth: 2 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#f7931a',
                width: 14,
                height: 14,
              },
            });
          }
        });
      });
    });

    return { nodes: flowNodes, edges: flowEdges, rawTxMap: txMap };
  }, [analysis]);

  // Set default selected transaction
  useEffect(() => {
    if (nodes.length > 0 && !selectedTx) {
      setSelectedTx(nodes[0].id);
    }
  }, [nodes, selectedTx]);

  const onNodeClick = (_, node) => {
    setSelectedTx(node.id);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedTxid(true);
    setTimeout(() => setCopiedTxid(false), 2000);
  };

  const activeTx = selectedTx ? rawTxMap[selectedTx] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Network className="w-4 h-4 text-[#f7931a]" />
            Transaction Dependency Graph (DAG)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Directed Acyclic Graph of unconfirmed mempool dependencies (Parent → Child)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {nodes.length} nodes · {edges.length} dependency edges
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="p-12 text-center">
          <Network className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No dependency data available.</p>
          <p className="text-xs text-slate-400 mt-1">
            Collect a non-empty snapshot to visualize ancestor and descendant transaction links.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
          {/* React Flow Canvas */}
          <div className="lg:col-span-8 h-[460px] bg-slate-50 relative border-b lg:border-b-0 lg:border-r border-slate-200">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.25 }}
              minZoom={0.2}
              maxZoom={1.5}
            >
              <Background color="#cbd5e1" gap={16} size={1} />
              <Controls position="top-right" showInteractive={false} />
              <MiniMap
                nodeColor="#f7931a"
                maskColor="rgba(241, 245, 249, 0.7)"
                style={{ height: 80, width: 120 }}
              />
            </ReactFlow>

            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-200 text-[10px] text-slate-500 shadow-xs pointer-events-none">
              Click any transaction node to inspect ancestor and descendant metrics
            </div>
          </div>

          {/* Transaction Detail Panel */}
          <div className="lg:col-span-4 p-5 flex flex-col justify-between bg-white overflow-y-auto max-h-[460px]">
            {activeTx ? (
              <div className="space-y-4">
                {/* Header with TXID and copy */}
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">
                      Selected Transaction
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedTx)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#f7931a] transition-colors"
                      title="Copy full TXID"
                    >
                      {copiedTxid ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy TXID</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-xs text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200 break-all select-all">
                    {selectedTx}
                  </div>
                </div>

                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Fee</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatSat(activeTx.fee_sat || 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {formatBtc(activeTx.fee_sat || 0)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Feerate</span>
                    <span className="font-bold text-[#f7931a] text-sm">
                      {formatFeerate(activeTx.feerate_sat_vb || 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Individual
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Virtual Size</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatVsize(activeTx.vsize || 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {activeTx.weight ? `${activeTx.weight} WU` : `${activeTx.vsize * 4} WU`}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-medium">Package Feerate</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {formatFeerate(activeTx.package_feerate_sat_vb || activeTx.feerate_sat_vb || 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Tx + Ancestors
                    </span>
                  </div>
                </div>

                {/* Ancestor & Descendant Counts */}
                <div className="p-3 rounded-lg bg-orange-50/60 border border-orange-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#f7931a]" />
                      Ancestors Count
                    </span>
                    <span className="font-bold text-slate-800">
                      {activeTx.ancestor_count || 1}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 flex items-center gap-1.5">
                      <ArrowDownRight className="w-3.5 h-3.5 text-[#f7931a]" />
                      Descendants Count
                    </span>
                    <span className="font-bold text-slate-800">
                      {activeTx.descendant_count || 1}
                    </span>
                  </div>
                </div>

                {/* Parents (Depends) */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>Direct Parents (Depends on):</span>
                    <span className="text-slate-400">({(activeTx.depends || []).length})</span>
                  </div>
                  {(activeTx.depends || []).length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">None (Root transaction)</p>
                  ) : (
                    <div className="space-y-1">
                      {activeTx.depends.map((pTxid) => (
                        <button
                          key={pTxid}
                          type="button"
                          onClick={() => setSelectedTx(pTxid)}
                          className="w-full text-left font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md border border-slate-100 truncate transition-colors flex items-center justify-between"
                        >
                          <span>{truncateTxid(pTxid, 14)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Children (Spent by) */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>Direct Children (Spent by):</span>
                    <span className="text-slate-400">
                      {((activeTx.spent_by || activeTx.spentby || []).length)}
                    </span>
                  </div>
                  {((activeTx.spent_by || activeTx.spentby || []).length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic">None (Leaf transaction)</p>
                  ) : (
                    <div className="space-y-1">
                      {(activeTx.spent_by || activeTx.spentby || []).map((cTxid) => (
                        <button
                          key={cTxid}
                          type="button"
                          onClick={() => setSelectedTx(cTxid)}
                          className="w-full text-left font-mono text-[11px] text-orange-600 hover:text-orange-800 hover:bg-orange-50 px-2 py-1 rounded-md border border-slate-100 truncate transition-colors flex items-center justify-between"
                        >
                          <span>{truncateTxid(cTxid, 14)}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center p-6 text-slate-400 text-xs">
                Select a node to inspect its transaction metadata.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
