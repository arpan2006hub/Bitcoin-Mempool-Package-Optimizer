import json
from pathlib import Path
from typing import Any, Dict, List, Set

import networkx as nx

from src.graph import MempoolDependencyGraph
from src.package_builder import PackageBuilder


class ImprovedOptimizer:
    """
    Algorithm C:
    Improved dependency-aware transaction package optimizer.

    The optimizer considers:
    - package feerate
    - dependency depth
    - remaining block capacity
    - future descendant potential

    This is a research heuristic, not a reproduction of
    Bitcoin Core's production block-building algorithm.
    """

    def __init__(
        self,
        analysis_path: str,
        block_vsize_limit: int = 320,
    ):
        self.analysis_path = Path(analysis_path)
        self.block_vsize_limit = block_vsize_limit

        self.analysis: Dict[str, Any] = {}
        self.transactions: Dict[str, Any] = {}

        self.graph_builder = MempoolDependencyGraph(
            str(self.analysis_path)
        )

        self.graph: nx.DiGraph = nx.DiGraph()

    # ---------------------------------------------------------
    # Load analysis and dependency graph
    # ---------------------------------------------------------

    def load(self) -> None:
        if not self.analysis_path.exists():
            raise FileNotFoundError(
                f"Analysis file not found: {self.analysis_path}"
            )

        with self.analysis_path.open(
            "r",
            encoding="utf-8"
        ) as file:
            self.analysis = json.load(file)

        self.transactions = self.analysis.get(
            "transactions",
            {}
        )

        self.graph = self.graph_builder.build()

    # ---------------------------------------------------------
    # Dependency helpers
    # ---------------------------------------------------------

    def get_ancestors(
        self,
        txid: str
    ) -> Set[str]:

        ancestors = set(
            nx.ancestors(
                self.graph,
                txid
            )
        )

        ancestors.add(txid)

        return ancestors

    def get_descendants(
        self,
        txid: str
    ) -> Set[str]:

        descendants = set(
            nx.descendants(
                self.graph,
                txid
            )
        )

        return descendants

    # ---------------------------------------------------------
    # Package metrics
    # ---------------------------------------------------------

    def calculate_package_metrics(
        self,
        package: Set[str]
    ) -> Dict[str, float]:

        fee_sat = sum(
            self.transactions[txid].get(
                "fee_sat",
                0
            )
            for txid in package
        )

        vsize = sum(
            self.transactions[txid].get(
                "vsize",
                0
            )
            for txid in package
        )

        if vsize <= 0:
            feerate = 0.0
        else:
            feerate = fee_sat / vsize

        return {
            "fee_sat": fee_sat,
            "vsize": vsize,
            "feerate_sat_vb": feerate,
        }

    # ---------------------------------------------------------
    # Dependency depth
    # ---------------------------------------------------------

    def get_dependency_depth(
        self,
        txid: str
    ) -> int:

        ancestors = nx.ancestors(
            self.graph,
            txid
        )

        if not ancestors:
            return 0

        relevant_nodes = set(ancestors)
        relevant_nodes.add(txid)

        subgraph = self.graph.subgraph(
            relevant_nodes
        )

        if not nx.is_directed_acyclic_graph(
            subgraph
        ):
            return 0

        return nx.dag_longest_path_length(
            subgraph
        )

    # ---------------------------------------------------------
    # Future descendant potential
    # ---------------------------------------------------------

    def calculate_future_child_potential(
        self,
        package: Set[str],
        selected: Set[str],
    ) -> float:

        potential = 0.0

        candidate_descendants: Set[str] = set()

        for txid in package:

            descendants = self.get_descendants(
                txid
            )

            candidate_descendants.update(
                descendants
            )

        # Ignore transactions already selected
        # and transactions already included in package.
        candidate_descendants -= selected
        candidate_descendants -= package

        for descendant in candidate_descendants:

            tx = self.transactions.get(
                descendant,
                {}
            )

            fee_sat = tx.get(
                "fee_sat",
                0
            )

            vsize = tx.get(
                "vsize",
                0
            )

            if vsize <= 0:
                continue

            feerate = fee_sat / vsize

            # Only reward descendants that are
            # individually attractive.
            if feerate > 0:
                potential += feerate

        return potential

    # ---------------------------------------------------------
    # Candidate score
    # ---------------------------------------------------------

    def calculate_score(
        self,
        package: Set[str],
        selected: Set[str],
        remaining_space: int,
    ) -> Dict[str, float]:

        metrics = self.calculate_package_metrics(
            package
        )

        package_feerate = metrics[
            "feerate_sat_vb"
        ]

        # Determine maximum dependency depth
        # inside this package.
        depth = 0

        for txid in package:

            tx_depth = self.get_dependency_depth(
                txid
            )

            depth = max(
                depth,
                tx_depth
            )

        # Small depth adjustment.
        depth_factor = (
            1.0 +
            (0.10 / (1.0 + depth))
        )

        # Capacity factor.
        package_vsize = metrics["vsize"]

        if remaining_space <= 0:
            capacity_factor = 0.0

        elif package_vsize > remaining_space:
            capacity_factor = 0.0

        else:
            utilization = (
                package_vsize /
                remaining_space
            )

            utilization = min(
                utilization,
                1.0
            )

            capacity_factor = (
                0.95 +
                0.05 * utilization
            )

        future_potential = (
            self.calculate_future_child_potential(
                package,
                selected
            )
        )

        # Keep future-child influence deliberately small.
        future_bonus = (
            future_potential * 0.01
        )

        score = (
            package_feerate
            * depth_factor
            * capacity_factor
            + future_bonus
        )

        return {
            "package_feerate_sat_vb":
                package_feerate,

            "dependency_depth":
                depth,

            "depth_factor":
                depth_factor,

            "capacity_factor":
                capacity_factor,

            "future_child_potential":
                future_potential,

            "future_bonus":
                future_bonus,

            "score":
                score,
        }

    # ---------------------------------------------------------
    # Candidate package
    # ---------------------------------------------------------

    def build_candidate_package(
        self,
        txid: str,
        selected: Set[str],
    ) -> Set[str]:

        package = self.get_ancestors(
            txid
        )

        # Remove transactions already selected.
        package -= selected

        return package

    # ---------------------------------------------------------
    # Optimization
    # ---------------------------------------------------------

    def optimize(self) -> Dict[str, Any]:

        if not self.transactions:
            self.load()

        selected: Set[str] = set()

        selected_order: List[str] = []

        total_fee = 0
        total_vsize = 0

        iterations = []

        while True:

            remaining_space = (
                self.block_vsize_limit
                - total_vsize
            )

            if remaining_space <= 0:
                break

            candidates = []

            for txid in self.transactions:

                if txid in selected:
                    continue

                package = (
                    self.build_candidate_package(
                        txid,
                        selected
                    )
                )

                if not package:
                    continue

                metrics = (
                    self.calculate_package_metrics(
                        package
                    )
                )

                package_vsize = metrics[
                    "vsize"
                ]

                if package_vsize > remaining_space:
                    continue

                score_data = (
                    self.calculate_score(
                        package,
                        selected,
                        remaining_space,
                    )
                )

                candidates.append(
                    {
                        "txid": txid,
                        "package": sorted(
                            package
                        ),
                        "package_size":
                            package_vsize,
                        "package_fee":
                            metrics["fee_sat"],
                        **score_data,
                    }
                )

            if not candidates:
                break

            # Select candidate with highest score.
            best = max(
                candidates,
                key=lambda item:
                    item["score"]
            )

            package = set(
                best["package"]
            )

            # Topological ordering is required.
            subgraph = self.graph.subgraph(
                package
            )

            try:
                ordered_package = list(
                    nx.topological_sort(
                        subgraph
                    )
                )
            except nx.NetworkXUnfeasible:
                break

            for package_txid in ordered_package:

                if package_txid in selected:
                    continue

                tx = self.transactions[
                    package_txid
                ]

                selected.add(
                    package_txid
                )

                selected_order.append(
                    package_txid
                )

                total_fee += tx.get(
                    "fee_sat",
                    0
                )

                total_vsize += tx.get(
                    "vsize",
                    0
                )

            iterations.append(
                {
                    "selected_for":
                        best["txid"],

                    "package":
                        ordered_package,

                    "package_fee_sat":
                        best["package_fee"],

                    "package_vsize":
                        best["package_size"],

                    "package_feerate_sat_vb":
                        best[
                            "package_feerate_sat_vb"
                        ],

                    "dependency_depth":
                        best[
                            "dependency_depth"
                        ],

                    "future_child_potential":
                        best[
                            "future_child_potential"
                        ],

                    "score":
                        best["score"],
                }
            )

        effective_feerate = (
            total_fee / total_vsize
            if total_vsize > 0
            else 0.0
        )

        return {
            "algorithm":
                "improved_dependency_aware",

            "block_vsize_limit":
                self.block_vsize_limit,

            "transactions_selected":
                len(selected_order),

            "total_fee_sat":
                total_fee,

            "total_vsize":
                total_vsize,

            "block_utilization":
                (
                    total_vsize /
                    self.block_vsize_limit
                ),

            "effective_feerate_sat_vb":
                effective_feerate,

            "selected_order":
                selected_order,

            "iterations":
                iterations,
        }

    # ---------------------------------------------------------
    # Save results
    # ---------------------------------------------------------

    def save_result(
        self,
        result: Dict[str, Any],
        output_path:
            str = "data/results/improved_optimizer_result.json",
    ) -> Path:

        output = Path(
            output_path
        )

        output.parent.mkdir(
            parents=True,
            exist_ok=True
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

        return output


def main():

    print(
        "Running improved dependency-aware optimizer..."
    )

    results_dir = Path("data/results")
    analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    if not analyses:
        raise FileNotFoundError("No analysis files found.")

    analysis_path = analyses[-1]

    optimizer = ImprovedOptimizer(
        str(analysis_path)
    )

    try:

        result = optimizer.optimize()

        print("\nOptimization complete.")

        print(
            f"Transactions selected: "
            f"{result['transactions_selected']}"
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
            f"Block utilization: "
            f"{result['block_utilization']:.2%}"
        )

        print(
            f"Effective feerate: "
            f"{result['effective_feerate_sat_vb']:.2f} sat/vB"
        )

        output = optimizer.save_result(
            result
        )

        print(
            "\nResult saved to:"
        )

        print(output)

    except Exception as error:

        print(
            "\nImproved optimizer failed:"
        )

        print(error)


if __name__ == "__main__":
    main()