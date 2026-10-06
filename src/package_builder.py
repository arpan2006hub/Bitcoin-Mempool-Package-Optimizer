import json
from pathlib import Path
from typing import Any, Dict, Set

import networkx as nx

from src.graph import MempoolDependencyGraph


class PackageBuilder:
    """
    Builds ancestor packages for transactions.

    For transaction C:

        A -> B -> C

    Package(C) = {A, B, C}
    """

    def __init__(
        self,
        analysis_path: str,
        graph: MempoolDependencyGraph,
    ):
        self.analysis_path = Path(
            analysis_path
        )

        self.graph_builder = graph

        self.analysis: Dict[str, Any] = {}
        self.transactions: Dict[str, Any] = {}

    # --------------------------------------------------
    # Load analysis
    # --------------------------------------------------

    def load_analysis(self) -> None:

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

        self.transactions = self.analysis.get(
            "transactions",
            {}
        )

    # --------------------------------------------------
    # Get ancestor package
    # --------------------------------------------------

    def get_package(
        self,
        txid: str
    ) -> Set[str]:

        if txid not in self.graph_builder.graph:
            raise ValueError(
                f"Transaction not found in graph: "
                f"{txid}"
            )

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

    def calculate_package(
        self,
        txid: str
    ) -> Dict[str, Any]:

        package_txids = self.get_package(
            txid
        )

        total_fee = 0
        total_vsize = 0

        for package_txid in package_txids:

            tx = self.transactions[
                package_txid
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

        if total_vsize > 0:
            package_feerate = (
                total_fee / total_vsize
            )
        else:
            package_feerate = 0.0

        # Calculate dependency depth.
        ancestors = (
            self.graph_builder.graph.subgraph(
                package_txids
            )
        )

        if len(package_txids) == 1:
            dependency_depth = 0
        else:
            try:
                dependency_depth = nx.dag_longest_path_length(
                    ancestors
                )
            except nx.NetworkXError:
                dependency_depth = 0

        return {
            "candidate_txid": txid,

            "transactions": sorted(
                package_txids
            ),

            "transaction_count": len(
                package_txids
            ),

            "total_fee_sat": total_fee,

            "total_vsize": total_vsize,

            "package_feerate_sat_vb": round(
                package_feerate,
                4
            ),

            "dependency_depth": (
                dependency_depth
            ),
        }

    # --------------------------------------------------
    # Build all packages
    # --------------------------------------------------

    def build_all_packages(
        self
    ) -> Dict[str, Dict[str, Any]]:

        if not self.analysis:
            self.load_analysis()

        packages = {}

        for txid in self.transactions:

            packages[txid] = (
                self.calculate_package(
                    txid
                )
            )

        return packages

    # --------------------------------------------------
    # Save packages
    # --------------------------------------------------

    def save_packages(
        self,
        packages: Dict[str, Dict[str, Any]],
        output_path: str = (
            "data/results/packages.json"
        ),
    ) -> Path:

        output = Path(output_path)

        output.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        with output.open(
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                packages,
                file,
                indent=4
            )

        return output


# ------------------------------------------------------
# Main
# ------------------------------------------------------

def main():

    results_dir = Path("data/results")
    analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    if not analyses:
        raise FileNotFoundError("No analysis files found.")

    analysis_path = analyses[-1]

    print(
        "Building transaction packages..."
    )

    graph_builder = (
        MempoolDependencyGraph(
            analysis_path
        )
    )

    try:

        graph_builder.build()

        package_builder = PackageBuilder(
            analysis_path,
            graph_builder
        )

        packages = (
            package_builder.build_all_packages()
        )

        print(
            f"Packages generated: "
            f"{len(packages)}"
        )

        for txid, package in packages.items():

            print(
                f"\nCandidate: {txid}"
            )

            print(
                f"  Transactions: "
                f"{package['transaction_count']}"
            )

            print(
                f"  Total fee: "
                f"{package['total_fee_sat']} sat"
            )

            print(
                f"  Total vsize: "
                f"{package['total_vsize']} vB"
            )

            print(
                f"  Package feerate: "
                f"{package['package_feerate_sat_vb']} "
                f"sat/vB"
            )

            print(
                f"  Dependency depth: "
                f"{package['dependency_depth']}"
            )

        output = (
            package_builder.save_packages(
                packages
            )
        )

        print(
            f"\nPackages saved to:\n{output}"
        )

    except Exception as error:

        print("\nPackage construction failed:")
        print(error)


if __name__ == "__main__":
    main()