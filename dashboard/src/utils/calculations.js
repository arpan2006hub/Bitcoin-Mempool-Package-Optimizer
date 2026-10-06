/**
 * Calculations and formatting utilities for Bitcoin Mempool Package Optimizer.
 * Centralized logic ensures metrics are calculated consistently across components.
 */

/**
 * Calculate average feerate in sat/vB.
 * @param {number} totalFeeSat - Total fee in satoshis
 * @param {number} totalVsize - Total virtual size in vB
 * @returns {number} Average feerate in sat/vB
 */
export function calculateAverageFeerate(totalFeeSat, totalVsize) {
  if (!totalVsize || totalVsize <= 0) return 0.0;
  return Number((totalFeeSat / totalVsize).toFixed(4));
}

/**
 * Calculate total fee in satoshis across a collection of transactions.
 * Handles both analysis format (where fees are already in satoshis or fee_sat)
 * and raw mempool format (where fees.base is in BTC).
 * @param {Object|Array} transactions - Dictionary or array of transaction objects
 * @returns {number} Total fee in satoshis
 */
export function calculateTotalFees(transactions) {
  if (!transactions) return 0;
  const list = Array.isArray(transactions) ? transactions : Object.values(transactions);

  return list.reduce((sum, tx) => {
    if (typeof tx.fee_sat === 'number') {
      return sum + tx.fee_sat;
    }
    if (tx.fees && typeof tx.fees.base === 'number') {
      return sum + Math.round(tx.fees.base * 100_000_000);
    }
    return sum;
  }, 0);
}

/**
 * Calculate total virtual size (vsize) across transactions.
 * @param {Object|Array} transactions
 * @returns {number} Total vsize in vB
 */
export function calculateTotalVsize(transactions) {
  if (!transactions) return 0;
  const list = Array.isArray(transactions) ? transactions : Object.values(transactions);

  return list.reduce((sum, tx) => sum + (Number(tx.vsize) || 0), 0);
}

/**
 * Calculate maximum dependency depth for a specific transaction or across the whole mempool.
 * @param {Object} transactions - Transaction map { txid: txData }
 * @param {string} [targetTxid] - Optional target txid
 * @returns {number} Maximum dependency depth (0 for root transactions)
 */
export function calculateDependencyDepth(transactions, targetTxid) {
  if (!transactions) return 0;

  const memo = new Map();

  const getDepth = (txid, visited = new Set()) => {
    if (visited.has(txid)) return 0; // Prevent cycle loops
    if (memo.has(txid)) return memo.get(txid);

    const tx = transactions[txid];
    if (!tx) return 0;

    const depends = tx.depends || [];
    if (!Array.isArray(depends) || depends.length === 0) {
      memo.set(txid, 0);
      return 0;
    }

    visited.add(txid);
    let maxParentDepth = 0;
    for (const parentTxid of depends) {
      if (transactions[parentTxid]) {
        const parentDepth = getDepth(parentTxid, new Set(visited));
        maxParentDepth = Math.max(maxParentDepth, parentDepth + 1);
      }
    }
    visited.delete(txid);

    memo.set(txid, maxParentDepth);
    return maxParentDepth;
  };

  if (targetTxid) {
    return getDepth(targetTxid);
  }

  // Calculate maximum depth across all transactions
  let maxDepth = 0;
  for (const txid of Object.keys(transactions)) {
    maxDepth = Math.max(maxDepth, getDepth(txid));
  }
  return maxDepth;
}

/**
 * Calculate improvement relative to baseline.
 * Label: "Difference relative to baseline"
 * @param {number} optimizerFee - Optimizer fee in satoshis
 * @param {number} baselineFee - Baseline fee in satoshis
 * @returns {{ feeDifference: number, relativeDifference: number | null }}
 */
export function calculateImprovement(optimizerFee, baselineFee) {
  const opt = Number(optimizerFee) || 0;
  const base = Number(baselineFee) || 0;
  const feeDifference = opt - base;

  if (base === 0) {
    return {
      feeDifference,
      relativeDifference: null,
    };
  }

  const relativeDifference = Number((((opt - base) / base) * 100).toFixed(2));
  return {
    feeDifference,
    relativeDifference,
  };
}

/**
 * Calculate block capacity utilization.
 * @param {number} totalWeight - Block weight in Weight Units (WU)
 * @param {number} [maxBlockWeight=4000000] - Standard MAX_BLOCK_WEIGHT
 * @returns {number} Ratio between 0 and 1
 */
export function calculateUtilization(totalWeight, maxBlockWeight = 4_000_000) {
  if (!maxBlockWeight || maxBlockWeight <= 0) return 0.0;
  return Math.min(1.0, (Number(totalWeight) || 0) / maxBlockWeight);
}

// ----------------------------------------------------
// Standardized Formatters
// ----------------------------------------------------

export function formatSat(sat) {
  if (sat === null || sat === undefined || isNaN(sat)) return '0 sat';
  return `${Number(sat).toLocaleString()} sat`;
}

export function formatBtc(sat) {
  if (sat === null || sat === undefined || isNaN(sat)) return '0.00000000 BTC';
  const btc = Number(sat) / 100_000_000;
  return `${btc.toFixed(8)} BTC`;
}

export function formatVsize(vsize) {
  if (vsize === null || vsize === undefined || isNaN(vsize)) return '0 vB';
  return `${Number(vsize).toLocaleString()} vB`;
}

export function formatFeerate(feerate) {
  if (feerate === null || feerate === undefined || isNaN(feerate)) return '0.00 sat/vB';
  return `${Number(feerate).toFixed(2)} sat/vB`;
}

export function formatPercent(percent) {
  if (percent === null || percent === undefined || isNaN(percent)) return '0.00%';
  return `${Number(percent).toFixed(2)}%`;
}

export function truncateTxid(txid, length = 8) {
  if (!txid) return '';
  if (txid.length <= length + 3) return txid;
  return `${txid.substring(0, length)}...`;
}
