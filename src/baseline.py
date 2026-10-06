import json
from pathlib import Path
from typing import Any, Dict, List, Set
import networkx as nx
from src.graph import MempoolDependencyGraph

'''
1. Calculate individual feerate
2. Sort transactions from highest to lowest
3. Select transactions until block capacity is reached
'''
class NaiveFeeRateSelector:
    """
    Baseline block-selection algorithm.

    Transactions are ranked by individual feerate.

    Required ancestors are automatically included so
    that the resulting transaction set respects
    dependency ordering.
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

    # --------------------------------------------------
    # Load analysis
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

    # --------------------------------------------------
    # Get required ancestors
    # --------------------------------------------------

    def required_transactions(
        self,
        txid: str
    ) -> Set[str]:

        ancestors = nx.ancestors(
            self.graph_builder.graph,
            txid
        )

        required = set(ancestors)

        required.add(txid)

        return required

    # --------------------------------------------------
    # Select block
    # --------------------------------------------------

    def select(self) -> Dict[str, Any]:

        self.load()

        # Sort by individual feerate.
        candidates = sorted(
            self.transactions.keys(),
            key=lambda txid:
                self.transactions[txid].get(
                    "feerate_sat_vb",
                    0
                ),
            reverse=True
        )

        selected: Set[str] = set()

        total_fee = 0
        total_vsize = 0

        for txid in candidates:

            required = (
                self.required_transactions(
                    txid
                )
            )

            new_transactions = (
                required - selected
            )

            additional_vsize = sum(
                int(
                    self.transactions[
                        candidate
                    ].get(
                        "vsize",
                        0
                    )
                )
                for candidate
                in new_transactions
            )

            if (
                total_vsize
                + additional_vsize
                > self.block_vsize_limit
            ):
                continue

            for candidate in new_transactions:

                selected.add(candidate)

                total_fee += int(
                    self.transactions[
                        candidate
                    ].get(
                        "fee_sat",
                        0
                    )
                )

                total_vsize += int(
                    self.transactions[
                        candidate
                    ].get(
                        "vsize",
                        0
                    )
                )

        effective_feerate = (
            total_fee / total_vsize
            if total_vsize > 0
            else 0
        )

        return {
            "algorithm": (
                "naive_fee_rate"
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
        }


def main():

    print(
        "Running naive fee-rate selection..."
    )

    results_dir = Path("data/results")
    analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    if not analyses:
        raise FileNotFoundError("No analysis files found.")

    analysis_path = analyses[-1]

    selector = NaiveFeeRateSelector(
        str(analysis_path)
    )

    try:

        result = selector.select()

        print("\nBaseline result:")

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

        output = Path(
            "data/results/baseline_result.json"
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

        print("\nBaseline failed:")
        print(error)


if __name__ == "__main__":
    main()