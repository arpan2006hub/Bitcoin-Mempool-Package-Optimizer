import json
from pathlib import Path
from typing import Any, Dict

from src.simulator import BlockSimulator


class AlgorithmComparator:

    def __init__(
        self,
        analysis_path: str,
    ):
        self.simulator = BlockSimulator(
            analysis_path
        )

    def load_result(
        self,
        path: str,
    ) -> Dict[str, Any]:

        result_path = Path(path)

        if not result_path.exists():
            raise FileNotFoundError(
                f"Result not found: "
                f"{result_path}"
            )

        with result_path.open(
            "r",
            encoding="utf-8",
        ) as file:

            return json.load(file)

    def run_algorithm(
        self,
        name: str,
        path: str,
    ) -> Dict[str, Any]:

        result = self.load_result(
            path
        )

        selected_order = result.get(
            "selected_order",
            result.get(
                "selected_transactions",
                []
            )
        )

        simulation = (
            self.simulator.simulate(
                selected_order
            )
        )

        return {
            "algorithm": name,
            **simulation,
        }

    def compare(self):

        algorithms = {
            "baseline":
                "data/results/"
                "baseline_result.json",

            "ancestor_package":
                "data/results/"
                "optimizer_result.json",

            "improved":
                "data/results/"
                "improved_optimizer_result.json",
        }

        results = []

        for name, path in algorithms.items():

            try:
                results.append(
                    self.run_algorithm(
                        name,
                        path
                    )
                )
            except FileNotFoundError as error:
                print(f"Skipping {name}: {error}")

        return results


def main():

    results_dir = Path("data/results")
    analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    if not analyses:
        raise FileNotFoundError("No analysis files found.")

    analysis_path = analyses[-1]

    comparator = AlgorithmComparator(
        str(analysis_path)
    )

    results = comparator.compare()

    print(
        "\n=============================="
    )

    print(
        "ALGORITHM COMPARISON"
    )

    print(
        "=============================="
    )

    for result in results:

        tx_count = result.get(
            "included_transaction_count",
            result.get("transactions_selected", 0)
        )

        print(
            f"\nAlgorithm: "
            f"{result['algorithm']}"
        )

        print(
            f"Transactions: "
            f"{tx_count}"
        )

        print(
            f"Fee: "
            f"{result['total_fee_sat']} sat"
        )

        print(
            f"Weight: "
            f"{result['total_weight']} WU"
        )

        print(
            f"Utilization: "
            f"{result['block_weight_utilization']:.2%}"
        )

        print(
            f"Effective feerate: "
            f"{result['effective_feerate_sat_vb']:.2f}"
            " sat/vB"
        )

    output_path = Path(
        "data/results/"
        "algorithm_comparison.json"
    )

    with output_path.open(
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            results,
            file,
            indent=4
        )

    print(
        "\nComparison saved to:"
    )

    print(output_path)


if __name__ == "__main__":
    main()