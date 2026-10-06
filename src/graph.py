import json
from pathlib import Path
from typing import Any, Dict, Optional

import networkx as nx


class MempoolDependencyGraph:
    """
    Builds a directed dependency graph from an analyzed
    Bitcoin mempool snapshot.

    Edge direction:

        parent -> child

    Meaning:

        child depends on parent.
    """

    def __init__(
        self,
        analysis_path: str,
    ):
        self.analysis_path = Path(analysis_path)

        self.analysis: Dict[str, Any] = {}
        self.transactions: Dict[str, Any] = {}

        self.graph = nx.DiGraph()

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
    # Add transaction nodes
    # --------------------------------------------------

    def add_nodes(self) -> None:

        for txid, tx in self.transactions.items():

            self.graph.add_node(
                txid,
                txid=txid,
                fee_sat=tx.get(
                    "fee_sat",
                    0
                ),
                vsize=tx.get(
                    "vsize",
                    0
                ),
                feerate_sat_vb=tx.get(
                    "feerate_sat_vb",
                    0.0
                ),
            )

    # --------------------------------------------------
    # Add dependency edges
    # --------------------------------------------------

    def add_edges(self) -> None:

        for txid, tx in self.transactions.items():

            dependencies = tx.get(
                "depends",
                []
            )

            for parent_txid in dependencies:

                # Only add an edge if the parent is
                # actually present in the snapshot.
                if parent_txid in self.graph:

                    self.graph.add_edge(
                        parent_txid,
                        txid
                    )

    # --------------------------------------------------
    # Build graph
    # --------------------------------------------------

    def build(self) -> nx.DiGraph:

        if not self.analysis:
            self.load_analysis()

        self.add_nodes()
        self.add_edges()

        return self.graph

    # --------------------------------------------------
    # Graph statistics
    # --------------------------------------------------

    def get_statistics(self) -> Dict[str, Any]:

        if self.graph.number_of_nodes() == 0:
            return {
                "nodes": 0,
                "edges": 0,
                "is_dag": True,
                "root_transactions": 0,
                "dependent_transactions": 0,
            }

        roots = [
            node
            for node in self.graph.nodes
            if self.graph.in_degree(node) == 0
        ]

        dependent = [
            node
            for node in self.graph.nodes
            if self.graph.in_degree(node) > 0
        ]

        return {
            "nodes": self.graph.number_of_nodes(),
            "edges": self.graph.number_of_edges(),
            "is_dag": nx.is_directed_acyclic_graph(
                self.graph
            ),
            "root_transactions": len(roots),
            "dependent_transactions": len(
                dependent
            ),
        }

    # --------------------------------------------------
    # Save graph
    # --------------------------------------------------

    def save_graph(
        self,
        output_path: str = "data/results/dependency_graph.json",
    ) -> Path:

        output = Path(output_path)
        output.parent.mkdir(
            parents=True,
            exist_ok=True
        )

        graph_data = nx.node_link_data(
            self.graph
        )

        with output.open(
            "w",
            encoding="utf-8"
        ) as file:
            json.dump(
                graph_data,
                file,
                indent=4
            )

        return output


def main():

    results_dir = Path("data/results")
    analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    if not analyses:
        raise FileNotFoundError("No analysis files found.")

    analysis_path = analyses[-1]

    print("Building transaction dependency graph...")
    print(f"Analysis: {analysis_path}")


    graph_builder = MempoolDependencyGraph(
        analysis_path
    )

    try:

        graph = graph_builder.build()

        stats = graph_builder.get_statistics()

        print("\nGraph statistics:")
        print(
            f"Transactions: {stats['nodes']}"
        )
        print(
            f"Dependencies: {stats['edges']}"
        )
        print(
            f"Root transactions: "
            f"{stats['root_transactions']}"
        )
        print(
            f"Dependent transactions: "
            f"{stats['dependent_transactions']}"
        )
        print(
            f"Graph is DAG: {stats['is_dag']}"
        )

        output = graph_builder.save_graph()

        print(
            f"\nGraph saved to:\n{output}"
        )

    except Exception as error:

        print("\nGraph construction failed:")
        print(error)


if __name__ == "__main__":
    main()