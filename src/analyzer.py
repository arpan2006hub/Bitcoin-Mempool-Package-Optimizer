import json
from pathlib import Path
from typing import Any, Dict, Optional


class MempoolAnalyzer:
    """
    Analyzes a Bitcoin Core mempool snapshot.

    Main metrics:
        - individual fee
        - individual feerate
        - ancestor fee
        - ancestor vsize
        - package fee
        - package vsize
        - package feerate
    """

    def __init__(
        self,
        snapshot_path: str,
        output_dir: str = "data/results",
    ):
        self.snapshot_path = Path(snapshot_path)
        self.output_dir = Path(output_dir)

        self.output_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        self.snapshot: Dict[str, Any] = {}
        self.transactions: Dict[str, Any] = {}

    # --------------------------------------------------
    # Load snapshot
    # --------------------------------------------------

    def load_snapshot(self) -> None:
        """Load a JSON mempool snapshot."""

        if not self.snapshot_path.exists():
            raise FileNotFoundError(
                f"Snapshot not found: {self.snapshot_path}"
            )

        with self.snapshot_path.open(
            "r",
            encoding="utf-8"
        ) as file:
            self.snapshot = json.load(file)

        self.transactions = self.snapshot.get(
            "transactions",
            {}
        )

    # --------------------------------------------------
    # Fee conversion
    # --------------------------------------------------

    @staticmethod
    def btc_to_satoshis(btc: float) -> int:
        """
        Convert BTC to satoshis.

        1 BTC = 100,000,000 satoshis.
        """

        return round(btc * 100_000_000)

    # --------------------------------------------------
    # Individual feerate
    # --------------------------------------------------

    @staticmethod
    def calculate_feerate(
        fee_sat: int,
        vsize: int
    ) -> float:
        """
        Calculate individual transaction feerate.

        Formula:

            feerate = fee / vsize

        Result:
            sat/vB
        """

        if vsize <= 0:
            return 0.0

        return fee_sat / vsize

    # --------------------------------------------------
    # Package metrics
    # --------------------------------------------------

    @staticmethod
    def calculate_package_feerate(
        package_fee_sat: int,
        package_vsize: int
    ) -> float:
        """
        Calculate package feerate.

        Formula:

            package_feerate =
                package_fee / package_vsize

        Result:
            sat/vB
        """

        if package_vsize <= 0:
            return 0.0

        return package_fee_sat / package_vsize

    # --------------------------------------------------
    # Analyze one transaction
    # --------------------------------------------------

    def analyze_transaction(
        self,
        txid: str,
        tx: Dict[str, Any]
    ) -> Dict[str, Any]:

        # ----------------------------------------------
        # Basic transaction information
        # ----------------------------------------------

        vsize = int(tx.get("vsize", 0))

        weight = int(tx.get("weight", 0))

        # ----------------------------------------------
        # Individual fee
        # ----------------------------------------------

        fees = tx.get("fees", {})

        # Bitcoin Core reports fees in BTC.
        fee_btc = float(
            fees.get("base", 0)
        )

        fee_sat = self.btc_to_satoshis(
            fee_btc
        )

        # ----------------------------------------------
        # Individual feerate
        # ----------------------------------------------

        feerate = self.calculate_feerate(
            fee_sat,
            vsize
        )

        # ----------------------------------------------
        # Ancestor information
        # ----------------------------------------------

        ancestor_count = int(
            tx.get("ancestorcount", 1)
        )

        ancestor_vsize = int(
            tx.get("ancestorsize", vsize)
        )

        ancestor_fee_btc = float(
            fees.get(
                "ancestor",
                fee_btc
            )
        )

        ancestor_fee_sat = self.btc_to_satoshis(
            ancestor_fee_btc
        )

        # ----------------------------------------------
        # Package information
        # ----------------------------------------------

        #
        # Bitcoin Core's ancestor values already
        # represent the transaction's ancestor set.
        #
        # Therefore:
        #
        # package fee =
        #     transaction + ancestors
        #
        # package vsize =
        #     transaction + ancestors
        #
        # However, ancestor fees/size already include
        # the transaction itself.
        #

        package_fee_sat = ancestor_fee_sat

        package_vsize = ancestor_vsize

        package_feerate = (
            self.calculate_package_feerate(
                package_fee_sat,
                package_vsize
            )
        )

        # ----------------------------------------------
        # Descendant information
        # ----------------------------------------------

        descendant_count = int(
            tx.get("descendantcount", 1)
        )

        descendant_vsize = int(
            tx.get(
                "descendantsize",
                vsize
            )
        )

        descendant_fee_btc = float(
            fees.get(
                "descendant",
                fee_btc
            )
        )

        descendant_fee_sat = self.btc_to_satoshis(
            descendant_fee_btc
        )

        # ----------------------------------------------
        # Dependencies
        # ----------------------------------------------

        depends = tx.get(
            "depends",
            []
        )

        spent_by = tx.get(
            "spentby",
            []
        )

        # ----------------------------------------------
        # Return analyzed transaction
        # ----------------------------------------------

        return {
            "txid": txid,

            "vsize": vsize,

            "weight": weight,

            "fee_btc": fee_btc,

            "fee_sat": fee_sat,

            "feerate_sat_vb": round(
                feerate,
                4
            ),

            "ancestor_count": ancestor_count,

            "ancestor_vsize": ancestor_vsize,

            "ancestor_fee_sat": ancestor_fee_sat,

            "package_fee_sat": package_fee_sat,

            "package_vsize": package_vsize,

            "package_feerate_sat_vb": round(
                package_feerate,
                4
            ),

            "descendant_count": descendant_count,

            "descendant_vsize": descendant_vsize,

            "descendant_fee_sat": descendant_fee_sat,

            "depends": depends,

            "spent_by": spent_by,
        }

    # --------------------------------------------------
    # Analyze entire snapshot
    # --------------------------------------------------

    def analyze(self) -> Dict[str, Any]:

        if not self.snapshot:
            self.load_snapshot()

        analyzed_transactions = {}

        for txid, tx in self.transactions.items():

            analyzed_transactions[txid] = (
                self.analyze_transaction(
                    txid,
                    tx
                )
            )

        result = {
            "snapshot_time": self.snapshot.get(
                "snapshot_time"
            ),

            "transaction_count": len(
                analyzed_transactions
            ),

            "transactions": analyzed_transactions,
        }

        return result

    # --------------------------------------------------
    # Save analysis
    # --------------------------------------------------

    def save_analysis(
        self,
        analysis: Dict[str, Any],
        filename: Optional[str] = None,
    ) -> Path:

        if filename is None:
            filename = (
                f"analysis_"
                f"{self.snapshot_path.stem}.json"
            )

        output_path = (
            self.output_dir / filename
        )

        with output_path.open(
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                analysis,
                file,
                indent=4
            )

        return output_path


# ======================================================
# Main
# ======================================================

def main():

    snapshot_dir = Path("data/snapshots")
    snapshots = sorted(snapshot_dir.glob("snapshot_*.json"))

    if not snapshots:
        raise FileNotFoundError("No mempool snapshots found.")

    snapshot_path = snapshots[-1]

    print("Loading mempool snapshot...")

    analyzer = MempoolAnalyzer(
        snapshot_path
    )

    try:

        analysis = analyzer.analyze()

        print(
            f"Transactions analyzed: "
            f"{analysis['transaction_count']}"
        )

        output_path = analyzer.save_analysis(
            analysis
        )

        print(
            "\nAnalysis saved to:"
        )

        print(output_path)

        # ----------------------------------------------
        # Display summary
        # ----------------------------------------------

        if analysis["transaction_count"] > 0:

            print(
                "\nTransaction metrics:"
            )

            for txid, tx in analysis[
                "transactions"
            ].items():

                print(
                    f"\nTXID: {txid}"
                )

                print(
                    f"  Fee: "
                    f"{tx['fee_sat']} sat"
                )

                print(
                    f"  vsize: "
                    f"{tx['vsize']} vB"
                )

                print(
                    f"  Individual feerate: "
                    f"{tx['feerate_sat_vb']} sat/vB"
                )

                print(
                    f"  Ancestors: "
                    f"{tx['ancestor_count']}"
                )

                print(
                    f"  Package fee: "
                    f"{tx['package_fee_sat']} sat"
                )

                print(
                    f"  Package vsize: "
                    f"{tx['package_vsize']} vB"
                )

                print(
                    f"  Package feerate: "
                    f"{tx['package_feerate_sat_vb']} sat/vB"
                )

    except Exception as error:

        print(
            "\nAnalyzer failed:"
        )

        print(error)


if __name__ == "__main__":
    main()