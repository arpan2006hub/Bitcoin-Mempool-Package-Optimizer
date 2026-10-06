import json
from pathlib import Path
from typing import Any, Dict, List


class BlockSimulator:
    """
    Simulates block construction using a transaction selection order
    produced by one of the project's algorithms.

    The simulator does NOT modify Bitcoin Core.
    It only evaluates a proposed transaction order against a block limit.
    """

    def __init__(
        self,
        analysis_path: str,
        max_block_weight: int = 4_000_000,
    ):
        self.analysis_path = Path(analysis_path)
        self.max_block_weight = max_block_weight

        self.analysis: Dict[str, Any] = {}
        self.transactions: Dict[str, Any] = {}

        self.load_analysis()

    def load_analysis(self) -> None:
        """Load transaction analysis data."""

        if not self.analysis_path.exists():
            raise FileNotFoundError(
                f"Analysis file not found: {self.analysis_path}"
            )

        with self.analysis_path.open("r", encoding="utf-8") as file:
            self.analysis = json.load(file)

        self.transactions = self.analysis.get("transactions", {})

    def simulate(
        self,
        selected_order: List[str],
    ) -> Dict[str, Any]:
        """
        Simulate a block using the supplied transaction order.

        Transactions that exceed the remaining block capacity are skipped.
        """

        selected_transactions = []
        skipped_transactions = []

        total_fee_sat = 0
        total_vsize = 0
        total_weight = 0

        included_txids = set()

        for txid in selected_order:

            # Ignore unknown transactions.
            if txid not in self.transactions:
                skipped_transactions.append({
                    "txid": txid,
                    "reason": "transaction_not_found",
                })
                continue

            tx = self.transactions[txid]

            vsize = int(tx.get("vsize", 0))

            # Prefer the actual Bitcoin Core weight recorded by the analyzer.
            # Fall back to 4 * vsize if weight is unavailable.
            weight = int(tx.get("weight", vsize * 4))

            fee_sat = int(tx.get("fee_sat", 0))

            # Check block capacity.
            if total_weight + weight > self.max_block_weight:
                skipped_transactions.append({
                    "txid": txid,
                    "reason": "block_capacity_exceeded",
                })
                continue

            # Check dependencies.
            dependencies = tx.get("depends", [])

            missing_dependencies = [
                dependency
                for dependency in dependencies
                if dependency not in included_txids
            ]

            if missing_dependencies:
                skipped_transactions.append({
                    "txid": txid,
                    "reason": "missing_dependencies",
                    "dependencies": missing_dependencies,
                })
                continue

            # Include transaction.
            selected_transactions.append({
                "txid": txid,
                "fee_sat": fee_sat,
                "vsize": vsize,
                "weight": weight,
            })

            included_txids.add(txid)

            total_fee_sat += fee_sat
            total_vsize += vsize
            total_weight += weight

        utilization = (
            total_weight / self.max_block_weight
            if self.max_block_weight > 0
            else 0
        )

        effective_feerate = (
            total_fee_sat / total_vsize
            if total_vsize > 0
            else 0
        )

        return {
            "analysis_file": str(self.analysis_path),
            "max_block_weight": self.max_block_weight,

            "selected_order": selected_order,

            "included_transactions": [
                tx["txid"]
                for tx in selected_transactions
            ],

            "included_transaction_count": len(
                selected_transactions
            ),

            "skipped_transactions": skipped_transactions,

            "skipped_transaction_count": len(
                skipped_transactions
            ),

            "total_fee_sat": total_fee_sat,

            "total_fee_btc": total_fee_sat / 100_000_000,

            "total_vsize": total_vsize,

            "total_weight": total_weight,

            "block_weight_utilization": utilization,

            "block_weight_utilization_percent": utilization * 100,

            "effective_feerate_sat_vb": effective_feerate,
        }

    def save_result(
        self,
        result: Dict[str, Any],
        output_path: str,
    ) -> Path:
        """Save simulation results."""

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        with output.open("w", encoding="utf-8") as file:
            json.dump(result, file, indent=4)

        return output


def find_latest_analysis() -> Path:
    """Find the newest analysis snapshot."""

    results_dir = Path("data/results")

    analyses = sorted(
        results_dir.glob("analysis_snapshot_*.json")
    )

    if not analyses:
        raise FileNotFoundError(
            "No analysis files found in data/results."
        )

    return analyses[-1]


def load_algorithm_result(
    path: str,
) -> Dict[str, Any]:
    """Load an algorithm result JSON file."""

    result_path = Path(path)

    if not result_path.exists():
        raise FileNotFoundError(
            f"Algorithm result not found: {result_path}"
        )

    with result_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def extract_selected_order(
    algorithm_result: Dict[str, Any],
) -> List[str]:
    """
    Extract the transaction selection order from an
    algorithm result.

    The current baseline.py and optimizer.py use:
        selected_transactions
    """

    selected_order = algorithm_result.get("selected_transactions")

    if selected_order is None:
        raise KeyError(
            "Algorithm result does not contain "
            "'selected_transactions'."
        )

    if not isinstance(selected_order, list):
        raise TypeError(
            "'selected_transactions' must be a list."
        )

    return selected_order


def run_algorithm_simulation(
    simulator: BlockSimulator,
    algorithm_name: str,
    result_path: str,
) -> Dict[str, Any]:
    """Simulate one algorithm."""

    algorithm_result = load_algorithm_result(result_path)

    selected_order = extract_selected_order(
        algorithm_result
    )

    result = simulator.simulate(selected_order)

    result["algorithm"] = algorithm_name

    return result


def main():

    print("Loading latest analysis...")

    analysis_path = find_latest_analysis()

    print(f"Analysis file: {analysis_path}")

    simulator = BlockSimulator(
        str(analysis_path),
        max_block_weight=4_000_000,
    )

    print(
        f"Transactions available: "
        f"{len(simulator.transactions)}"
    )

    algorithms = [
        (
            "baseline",
            "data/results/baseline_result.json",
        ),
        (
            "optimizer",
            "data/results/optimizer_result.json",
        ),
        (
            "improved_optimizer",
            "data/results/improved_optimizer_result.json",
        ),
    ]

    all_results = {}

    for algorithm_name, result_path in algorithms:

        print(f"\nSimulating {algorithm_name}...")

        try:

            result = run_algorithm_simulation(
                simulator,
                algorithm_name,
                result_path,
            )

            all_results[algorithm_name] = result

            print(
                f"Transactions included: "
                f"{result['included_transaction_count']}"
            )

            print(
                f"Total fee: "
                f"{result['total_fee_sat']} sat"
            )

            print(
                f"Total vsize: "
                f"{result['total_vsize']} vB"
            )

            print(
                f"Total weight: "
                f"{result['total_weight']} WU"
            )

            print(
                f"Block utilization: "
                f"{result['block_weight_utilization_percent']:.4f}%"
            )

            print(
                f"Effective feerate: "
                f"{result['effective_feerate_sat_vb']:.4f} sat/vB"
            )

        except FileNotFoundError as error:

            print(
                f"Skipping {algorithm_name}: {error}"
            )

        except (KeyError, TypeError) as error:

            print(
                f"Invalid result for {algorithm_name}: "
                f"{error}"
            )

    if not all_results:
        raise RuntimeError(
            "No algorithm results could be simulated."
        )

    output_path = Path(
        "data/results/simulation_results.json"
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with output_path.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            all_results,
            file,
            indent=4,
        )

    print("\nSimulation complete.")

    print(
        f"Results saved to:\n{output_path}"
    )


if __name__ == "__main__":
    main()

