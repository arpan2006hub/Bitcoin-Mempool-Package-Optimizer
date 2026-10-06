import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Header from './components/Header';
import MetricCard from './components/MetricCard';
import MempoolOverview from './components/MempoolOverview';
import DependencyGraph from './components/DependencyGraph';
import PackageTable from './components/PackageTable';
import AlgorithmComparison from './components/AlgorithmComparison';
import OptimizationChart from './components/OptimizationChart';
import SimulationResult from './components/SimulationResult';
import SnapshotSelector from './components/SnapshotSelector';
import { fetchAllDashboardData, getSnapshot, getAnalysis } from './data/api';
import {
  calculateTotalFees,
  calculateTotalVsize,
  calculateAverageFeerate,
  calculateDependencyDepth,
  formatSat,
  formatBtc,
  formatVsize,
  formatFeerate
} from './utils/calculations';
import {
  Hash,
  Scale,
  Database,
  TrendingUp,
  GitBranch,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  Layers
} from 'lucide-react';

export default function App() {
  const [selectedNetwork, setSelectedNetwork] = useState('regtest');
  const [currentSnapshotId, setCurrentSnapshotId] = useState(null);
  const [data, setData] = useState({
    snapshot: null,
    analysis: null,
    baseline: null,
    optimizer: null,
    improved: null,
    simulation: null,
    comparison: null,
    packages: null,
    graph: null,
    history: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const statusPollRef = useRef(null);

  // Load all initial data
  const loadData = useCallback(async (snapshotFile, analysisFile) => {
    try {
      setError(null);
      const res = await fetchAllDashboardData(snapshotFile, analysisFile);

      setData(res);
      setLastUpdated(new Date().toISOString());

      // If currentSnapshotId is not set, set to the latest from history
      if (res.history && res.history.length > 0 && !snapshotFile) {
        const latest = res.history[res.history.length - 1];
        setCurrentSnapshotId(latest.id);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard research data. Ensure export_dashboard_data.py has been run.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll /api/status every 30 s to detect when source files are newer than public copies
  useEffect(() => {
    const checkStaleness = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const status = await res.json();
          setIsStale(status.is_stale === true);
        }
      } catch {
        // Backend may not be running — silently ignore
      }
    };

    checkStaleness(); // immediate check on mount
    statusPollRef.current = setInterval(checkStaleness, 30_000);
    return () => clearInterval(statusPollRef.current);
  }, []);

  // Handle Refresh — calls backend to re-run the export pipeline first
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setNotification({ type: 'info', message: 'Syncing latest research files to dashboard…' });
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const result = await res.json();
      setIsStale(false);
      await loadData(
        currentSnapshotId ? `snapshots/snapshot_${currentSnapshotId}.json` : undefined,
        currentSnapshotId ? `analyses/analysis_snapshot_${currentSnapshotId}.json` : undefined
      );
      setNotification({
        type: 'success',
        message: `Dashboard refreshed. Loaded ${result.latest_snapshot ?? 'latest snapshot'}.`,
      });
    } catch (e) {
      setNotification({ type: 'error', message: `Refresh failed: ${e.message}` });
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Handle Run Analysis — re-exports the latest pipeline results then reloads
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setNotification({
      type: 'info',
      message: 'Exporting latest pipeline results to dashboard…',
    });
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const result = await res.json();
      setIsStale(false);
      await loadData();
      setNotification({
        type: 'success',
        message: `Analysis complete. Loaded ${result.latest_snapshot ?? 'latest snapshot'}.`,
      });
    } catch (e) {
      setNotification({ type: 'error', message: `Analysis export failed: ${e.message}` });
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Handle Historical Snapshot selection
  const handleSelectSnapshot = async (snapshotItem) => {
    setCurrentSnapshotId(snapshotItem.id);
    setIsRefreshing(true);

    try {
      const snapPath = `snapshots/${snapshotItem.snapshot_file}`;
      const anaPath = snapshotItem.analysis_file ? `analyses/${snapshotItem.analysis_file}` : undefined;

      const [newSnap, newAna] = await Promise.all([
        getSnapshot(snapPath),
        anaPath ? getAnalysis(anaPath) : null,
      ]);

      setData((prev) => ({
        ...prev,
        snapshot: newSnap || prev.snapshot,
        analysis: newAna || prev.analysis,
      }));

      setNotification({
        type: 'info',
        message: `Switched active view to ${snapshotItem.name}.`,
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (e) {
      console.error('Error changing snapshot:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate Top 5 Metrics from active analysis/snapshot
  const metrics = useMemo(() => {
    const txMap = data.analysis?.transactions || data.snapshot?.transactions || {};
    const txList = Object.values(txMap);
    const count = txList.length;

    const totalFees = calculateTotalFees(txMap);
    const totalVsize = calculateTotalVsize(txMap);
    const avgFeerate = calculateAverageFeerate(totalFees, totalVsize);
    const maxDepth = calculateDependencyDepth(txMap);

    return {
      count,
      totalVsize,
      totalFees,
      avgFeerate,
      maxDepth,
    };
  }, [data.analysis, data.snapshot]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* Top Main Navigation Header */}
      <Header
        selectedNetwork={selectedNetwork}
        onSelectNetwork={setSelectedNetwork}
        onRefresh={handleRefresh}
        onRunAnalysis={handleRunAnalysis}
        isRefreshing={isRefreshing}
        isAnalyzing={isAnalyzing}
        lastUpdated={lastUpdated}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Staleness Warning Banner */}
        {isStale && !isRefreshing && (
          <div
            role="alert"
            className="p-3 rounded-xl border border-amber-300 bg-amber-50 flex items-center justify-between text-xs font-medium shadow-xs"
          >
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>New research data detected. Click <strong>Refresh</strong> to load the latest snapshot.</span>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="ml-3 px-2 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors"
            >
              Refresh now
            </button>
          </div>
        )}

        {/* Toast / Notification Banner */}
        {notification && (
          <div
            role="status"
            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium transition-all shadow-xs ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 ml-2"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-3 shadow-xs"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold">Data Synchronization Warning</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Section 1: Top 5 Metric Cards */}
        <section aria-label="Key Mempool Metrics">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard
              title="Transactions"
              value={metrics.count}
              unit="txs"
              subtext="In active mempool"
              icon={Hash}
              accentColor="text-blue-600"
              bgColor="bg-blue-50"
            />
            <MetricCard
              title="Total vsize"
              value={formatVsize(metrics.totalVsize).replace(' vB', '')}
              unit="vB"
              subtext={`${(metrics.totalVsize * 4).toLocaleString()} WU`}
              icon={Scale}
              accentColor="text-slate-700"
              bgColor="bg-slate-100"
            />
            <MetricCard
              title="Total Fees"
              value={formatSat(metrics.totalFees).replace(' sat', '')}
              unit="sat"
              subtext={formatBtc(metrics.totalFees)}
              icon={Database}
              accentColor="text-[#f7931a]"
              bgColor="bg-orange-50"
            />
            <MetricCard
              title="Average Feerate"
              value={metrics.avgFeerate.toFixed(1)}
              unit="sat/vB"
              subtext="Unweighted rate"
              icon={TrendingUp}
              accentColor="text-emerald-600"
              bgColor="bg-emerald-50"
            />
            <MetricCard
              title="Dependency Depth"
              value={metrics.maxDepth}
              unit="levels"
              subtext="Max ancestor chain"
              icon={GitBranch}
              accentColor="text-purple-600"
              bgColor="bg-purple-50"
            />
          </div>
        </section>

        {/* Section 2: Mempool Overview Details */}
        <section aria-label="Mempool Telemetry Overview">
          <MempoolOverview
            analysis={data.analysis}
            snapshot={data.snapshot}
          />
        </section>

        {/* Section 3: Interactive Dependency DAG (React Flow) */}
        <section aria-label="Transaction Dependency DAG">
          <DependencyGraph
            analysis={data.analysis}
            graphData={data.graph}
          />
        </section>

        {/* Section 4: Ancestor Package Analysis Table */}
        <section aria-label="Ancestor Package Analysis">
          <PackageTable
            packagesData={data.packages}
            analysis={data.analysis}
          />
        </section>

        {/* Section 5: Algorithm Comparison Table & Improvement Metric */}
        <section aria-label="Algorithm Performance Comparison">
          <AlgorithmComparison
            comparisonData={data.comparison}
            baselineResult={data.baseline}
            optimizerResult={data.optimizer}
            improvedResult={data.improved}
          />
        </section>

        {/* Section 6: Optimization Charts (Fees & Feerate) */}
        <section aria-label="Fee and Feerate Charts">
          <OptimizationChart
            comparisonData={data.comparison}
            baselineResult={data.baseline}
            optimizerResult={data.optimizer}
            improvedResult={data.improved}
          />
        </section>

        {/* Section 7: Block Assembly Simulation */}
        <section aria-label="Block Selection Simulation">
          <SimulationResult
            simulationData={data.simulation}
            comparisonData={data.comparison}
          />
        </section>

        {/* Section 8: Historical Snapshots Progression */}
        <section aria-label="Historical Snapshot Progression">
          <SnapshotSelector
            historyData={data.history}
            currentSnapshotId={currentSnapshotId}
            onSelectSnapshot={handleSelectSnapshot}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <div className="flex items-center justify-center gap-2 font-semibold text-slate-700">
            <span className="text-[#f7931a] font-bold">₿</span>
            <span>Bitcoin Mempool Package Optimizer</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 font-normal">Experimental Research Layer</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Bitcoin Core JSON-RPC research interface. Visualizes deterministic transaction package ranking under ancestor constraints.
          </p>

          <p className="text-[10px] text-slate-400 italic max-w-xl mx-auto pt-2 border-t border-slate-100">
            Research Disclaimer: This application is an experimental telemetry and visualization tool designed for studying ancestor package feerate heuristics in controlled environments.
          </p>
        </div>
      </footer>
    </div>
  );
}
