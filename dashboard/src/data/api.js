/**
 * Data abstraction layer for Bitcoin Mempool Package Optimizer.
 * Keeps data loading separate from UI components.
 * Loads research JSON files from /data/ or allows future live API integration.
 */

const BASE_URL = '/data';

async function fetchJson(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}?_t=${Date.now()}`);
    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`File not found: ${endpoint}`);
        return null;
      }
      throw new Error(`HTTP error ${res.status} fetching ${endpoint}`);
    }
    return await res.json();
  } catch (error) {
    console.warn(`Could not load ${endpoint}:`, error.message);
    return null;
  }
}

export async function getSnapshot(customPath) {
  return await fetchJson(customPath || 'snapshot.json');
}

export async function getAnalysis(customPath) {
  return await fetchJson(customPath || 'analysis.json');
}

export async function getBaselineResult() {
  return await fetchJson('baseline.json');
}

export async function getOptimizerResult() {
  return await fetchJson('optimizer.json');
}

export async function getImprovedResult() {
  return await fetchJson('improved.json');
}

export async function getSimulationResult() {
  return await fetchJson('simulation.json');
}

export async function getComparisonResult() {
  return await fetchJson('comparison.json');
}

export async function getPackagesResult() {
  return await fetchJson('packages.json');
}

export async function getGraphResult() {
  return await fetchJson('graph.json');
}

export async function getSnapshotsHistory() {
  return await fetchJson('snapshots_history.json');
}

/**
 * Fetch all data required for the dashboard simultaneously.
 * @param {string} [snapshotPath] - Optional custom path for snapshot
 * @param {string} [analysisPath] - Optional custom path for analysis
 */
export async function fetchAllDashboardData(snapshotPath, analysisPath) {
  const [
    snapshot,
    analysis,
    baseline,
    optimizer,
    improved,
    simulation,
    comparison,
    packages,
    graph,
    history,
  ] = await Promise.all([
    getSnapshot(snapshotPath),
    getAnalysis(analysisPath),
    getBaselineResult(),
    getOptimizerResult(),
    getImprovedResult(),
    getSimulationResult(),
    getComparisonResult(),
    getPackagesResult(),
    getGraphResult(),
    getSnapshotsHistory(),
  ]);

  return {
    snapshot,
    analysis,
    baseline,
    optimizer,
    improved,
    simulation,
    comparison,
    packages,
    graph,
    history,
  };
}
