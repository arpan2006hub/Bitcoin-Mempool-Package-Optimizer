# Bitcoin Mempool Package Optimizer

A Python and React-based research framework and simulation tool for evaluating **dependency-aware transaction package selection** and **block template construction** in Bitcoin.

---

## Overview

In Bitcoin, miners construct blocks to maximize transaction fee revenue subject to protocol constraints (such as the 4,000,000 Weight Unit / ~1 MB vsize block limit). However, transactions in the mempool frequently depend on unconfirmed parent transactions, forming a **Directed Acyclic Graph (DAG)** of dependencies.

Standard naive selection algorithms (sorting strictly by individual transaction feerate) struggle in the presence of unconfirmed dependency chains (e.g., Child-Pays-For-Parent / CPFP):
- High-feerate child transactions cannot be included without their low-feerate parents.
- Selecting low-feerate parents in isolation appears unprofitable unless the total package value is evaluated.

This project implements, simulates, and benchmarks multiple transaction selection strategies against live or captured Bitcoin Core mempool snapshots, complete with DAG dependency resolution, block simulation, and an interactive React dashboard.

---

## Architecture & Pipeline

```
  +--------------------+
  |  Bitcoin Core RPC  |  (Live node / Regtest)
  +---------+----------+
            |
            v
  +--------------------+
  | Mempool Collector  |  -->  data/snapshots/snapshot_*.json
  +---------+----------+
            |
            v
  +--------------------+
  |  Mempool Analyzer  |  -->  data/results/analysis_snapshot_*.json
  +---------+----------+
            |
            v
  +--------------------+
  |  DAG Graph Engine  |  (NetworkX dependency modeling)
  +---------+----------+
            |
            +----------------------+----------------------+
            |                      |                      |
            v                      v                      v
    +---------------+      +---------------+      +---------------+
    |  Baseline A   |      |  Package B    |      |  Heuristic C  |
    | (Individual)  |      | (Ancestor CPFP|      |  (Multi-factor|
    +-------+-------+      +-------+-------+      +-------+-------+
            |                      |                      |
            +----------------------+----------------------+
                                   |
                                   v
                         +-------------------+
                         |  Block Simulator  |  --> data/results/algorithm_comparison.json
                         +---------+---------+
                                   |
                                   v
                         +-------------------+
                         | React + FastAPI   |
                         | Interactive UI    |
                         +-------------------+
```

---

## Algorithms Implemented

| Algorithm | Strategy | Description |
| :--- | :--- | :--- |
| **Algorithm A: Baseline** | Individual Feerate | Sorts transactions by individual feerate ($sat/vB$) and automatically pulls in missing ancestors to maintain topological validity. |
| **Algorithm B: Ancestor Package** | Greedy Package Feerate | Evaluates candidate transactions as packages with all unconfirmed ancestors, ranking by composite package feerate ($\sum \text{fees} / \sum \text{vsize}$). |
| **Algorithm C: Improved Heuristic** | Multi-Factor Heuristic | Evaluates package feerate, remaining block capacity (knapsack efficiency), dependency chain depth, and future descendant potential. |

---

## Project Structure

```
mempool-package-optimizer/
├── config/
│   └── networks.json              # Network configurations (mainnet, testnet, regtest)
├── data/
│   ├── snapshots/                 # Captured raw mempool JSON snapshots
│   └── results/                   # Analysis outputs, algorithm selections, comparisons
├── dashboard/                     # Interactive React + Vite frontend
│   ├── src/                       # React components, graphs, and metric views
│   └── package.json
├── src/
│   ├── analyzer.py                # Computes fee, vsize, ancestor/descendant metrics
│   ├── baseline.py                # Algorithm A: Individual feerate selector
│   ├── collector.py               # Fetches verbose mempool snapshots via Bitcoin RPC
│   ├── compare_algorithms.py      # Benchmark runner and comparator across algorithms
│   ├── core_integration.py        # Bitcoin Core CLI integration utilities
│   ├── dashboard_api.py           # FastAPI bridge for real-time dashboard data
│   ├── export_dashboard_data.py   # Synchronizes pipeline results with the dashboard
│   ├── graph.py                   # NetworkX directed graph builder for mempool DAGs
│   ├── improved_optimizer.py      # Algorithm C: Multi-factor package optimizer
│   ├── main.py                    # RPC connection verification script
│   ├── optimizer.py               # Algorithm B: Dependency-aware package optimizer
│   ├── package_builder.py         # Constructs valid topologically sorted packages
│   ├── package_validator.py       # Validates packages via Bitcoin Core testmempoolaccept
│   ├── rpc.py                     # Bitcoin Core JSON-RPC client
│   └── simulator.py               # Evaluates block limits (weight, vsize) and total fees
├── tests/                         # Unit and integration tests
├── requirements.txt               # Python dependencies
└── README.md
```

---

## Getting Started

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm** (for the UI dashboard)
- *(Optional)* **Bitcoin Core** (v24.0+ recommended for regtest / RPC integration)

### 2. Python Environment Setup

```bash
# Clone the repository
git clone https://github.com/arpan2006hub/Bitcoin-Mempool-Package-Optimizer.git
cd Bitcoin-Mempool-Package-Optimizer

# Create and activate virtual environment
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
pip install fastapi uvicorn
```

---

## Execution Workflow

### Step 1: Collect or Supply a Mempool Snapshot
To capture the mempool state from a running Bitcoin node:
```bash
python -m src.collector
```
*(Snapshots are saved under `data/snapshots/snapshot_XXX.json`)*

### Step 2: Analyze Mempool Dependencies
Compute ancestor/descendant sets, individual feerates, and package metrics:
```bash
python -m src.analyzer
```

### Step 3: Run Selection Algorithms
Run the optimizers against the analyzed snapshot:
```bash
# Run Baseline (Algorithm A)
python -m src.baseline

# Run Ancestor Package Optimizer (Algorithm B)
python -m src.optimizer

# Run Improved Heuristic Optimizer (Algorithm C)
python -m src.improved_optimizer
```

### Step 4: Compare Benchmark Results
Simulate block template inclusion and generate a comparative summary:
```bash
python -m src.compare_algorithms
```

Example output:
```text
==============================
ALGORITHM COMPARISON
==============================

Algorithm: baseline
Transactions: 1420
Fee: 2845012 sat
Weight: 3998240 WU
Utilization: 99.96%
Effective feerate: 28.46 sat/vB

Algorithm: ancestor_package
Transactions: 1485
Fee: 3120450 sat
Weight: 3999480 WU
Utilization: 99.99%
Effective feerate: 31.21 sat/vB

Algorithm: improved
Transactions: 1510
Fee: 3189200 sat
Weight: 3999800 WU
Utilization: 100.00%
Effective feerate: 31.89 sat/vB
```

---

## Interactive Dashboard

The project includes an interactive web dashboard to inspect DAG topologies, review block weight utilization, and compare revenue curves.

### 1. Start the API Backend
```bash
python -m src.dashboard_api
```
*(Runs FastAPI server on `http://127.0.0.1:5174`)*

### 2. Start the React Frontend
```bash
cd dashboard
npm install
npm run dev
```
Open `http://localhost:5173` in your browser to explore the dashboard.

---

## Testing

Run test suites using `unittest` or `pytest`:
```bash
python -m unittest discover tests
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
