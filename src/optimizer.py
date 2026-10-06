import json
from pathlib import Path
from typing import Any, Dict, Set

import networkx as nx

from src.graph import MempoolDependencyGraph
from src.package_builder import PackageBuilder


class DependencyAwareOptimizer:
    """
    Greedy dependency-aware transaction package optimizer.

    Candidate packages are ranked by package feerate.

    A package contains the candidate transaction and all
    of its required ancestors.
    """

    def __init__(
        self,
        analysis_path: str,
        block_vsize_limit: int = 320,
    ):
        self.analysis_path = Path(
            analysis_path
        )

        self.block_vsize_limit = (
            block_vsize_limit
        )

        self.analysis: Dict[str, Any] = {}
        self.transactions: Dict[str, Any] = {}

        self.graph_builder = (
            MempoolDependencyGraph(
                analysis_path
            )
        )

        self.package_builder = None

    # --------------------------------------------------
    # Load data
    # --------------------------------------------------

    def load(self):

        if not self.analysis_path.exists():
            raise FileNotFoundError(
                f"Analysis file not found: "
                f"{self.analysis_path}"
            )

        with self.analysis_path.open(
            "r",
            encoding="utf-8"
        ) as file:
            self.analysis = json.load(file)

        self.transactions = (
            self.analysis.get(
                "transactions",
                {}
            )
        )

        self.graph_builder.build()

        self.package_builder = (
            PackageBuilder(
                str(self.analysis_path),
                self.graph_builder
            )
        )

        self.package_builder.load_analysis()

    # --------------------------------------------------
    # Required package
    # --------------------------------------------------

    def required_package(
        self,
        txid: str
    ) -> Set[str]:

        ancestors = nx.ancestors(
            self.graph_builder.graph,
            txid
        )

        package = set(ancestors)

        package.add(txid)

        return package

    # --------------------------------------------------
    # Calculate package metrics
    # --------------------------------------------------

    def calculate_package_metrics(
        self,
        txids: Set[str]
    ) -> Dict[str, Any]:

        total_fee = 0
        total_vsize = 0

        for txid in txids:

            tx = self.transactions[
                txid
            ]

            total_fee += int(
                tx.get(
                    "fee_sat",
                    0
                )
            )

            total_vsize += int(
                tx.get(
                    "vsize",
                    0
                )
            )

        package_feerate = (
            total_fee / total_vsize
            if total_vsize > 0
            else 0
        )

        return {
            "transactions": txids,
            "total_fee_sat": total_fee,
            "total_vsize": total_vsize,
            "package_feerate_sat_vb": (
                package_feerate
            ),
        }

    # --------------------------------------------------
    # Optimize
    # --------------------------------------------------

    def optimize(self) -> Dict[str, Any]:

        self.load()

        selected: Set[str] = set()

        total_fee = 0
        total_vsize = 0

        iterations = 0

        while True:

            iterations += 1

            best_candidate = None
            best_package = None
            best_metrics = None

            # ------------------------------------------
            # Evaluate every unselected candidate
            # ------------------------------------------

            for txid in self.transactions:

                if txid in selected:
                    continue

                full_package = (
                    self.required_package(
                        txid
                    )
                )

                # Only count transactions that aren't
                # already selected.
                new_package = (
                    full_package - selected
                )

                if not new_package:
                    continue

                metrics = (
                    self.calculate_package_metrics(
                        new_package
                    )
                )

                package_vsize = (
                    metrics["total_vsize"]
                )

                if (
                    total_vsize
                    + package_vsize
                    > self.block_vsize_limit
                ):
                    continue

                package_feerate = (
                    metrics[
                        "package_feerate_sat_vb"
                    ]
                )

                if (
                    best_metrics is None
                    or package_feerate
                    > best_metrics[
                        "package_feerate_sat_vb"
                    ]
                ):
                    best_candidate = txid
                    best_package = new_package
                    best_metrics = metrics

            # ------------------------------------------
            # No package fits
            # ------------------------------------------

            if best_candidate is None:
                break

            # ------------------------------------------
            # Add best package
            # ------------------------------------------

            selected.update(
                best_package
            )

            total_fee += (
                best_metrics[
                    "total_fee_sat"
                ]
            )

            total_vsize += (
                best_metrics[
                    "total_vsize"
                ]
            )

            # ------------------------------------------
            # Safety condition
            # ------------------------------------------

            if (
                total_vsize
                >= self.block_vsize_limit
            ):
                break

        effective_feerate = (
            total_fee / total_vsize
            if total_vsize > 0
            else 0
        )

        return {
            "algorithm": (
                "dependency_aware_package"
            ),

            "block_vsize_limit": (
                self.block_vsize_limit
            ),

            "selected_transactions": sorted(
                selected
            ),

            "transaction_count": len(
                selected
            ),

            "total_fee_sat": total_fee,

            "total_vsize": total_vsize,

            "effective_feerate_sat_vb": round(
                effective_feerate,
                4
            ),

            "iterations": iterations,
        }


def main():

    print(
        "Running dependency-aware optimizer..."
    )

    results_dir = Path("data/results")
    analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    if not analyses:
        raise FileNotFoundError("No analysis files found.")

    analysis_path = analyses[-1]

    optimizer = DependencyAwareOptimizer(
        str(analysis_path)
    )

    try:

        result = optimizer.optimize()

        print(
            "\nOptimizer result:"
        )

        print(
            f"Transactions selected: "
            f"{result['transaction_count']}"
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
            f"Effective feerate: "
            f"{result['effective_feerate_sat_vb']} "
            f"sat/vB"
        )

        print(
            f"Iterations: "
            f"{result['iterations']}"
        )

        output = Path(
            "data/results/"
            "optimizer_result.json"
        )

        with output.open(
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                result,
                file,
                indent=4
            )

        print(
            f"\nResult saved to:\n{output}"
        )

    except Exception as error:

        print("\nOptimizer failed:")
        print(error)


if __name__ == "__main__":
    main()