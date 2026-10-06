import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from src.rpc import BitcoinRPC


class MempoolCollector:
    def __init__(
        self,
        rpc: BitcoinRPC,
        snapshot_dir: str = "data/snapshots",
    ):
        self.rpc = rpc
        self.snapshot_dir = Path(snapshot_dir)

        # Create snapshot directory if it does not exist
        self.snapshot_dir.mkdir(
            parents=True,
            exist_ok=True
        )

    def collect(self) -> Dict[str, Any]:
        """
        Collect the current Bitcoin Core mempool.

        Returns:
            A dictionary containing snapshot metadata
            and transaction information.
        """

        # Ask Bitcoin Core for detailed mempool information
        mempool = self.rpc.get_raw_mempool(verbose=True)

        snapshot = {
            "snapshot_time": datetime.now(
                timezone.utc
            ).isoformat(),

            "transaction_count": len(mempool),

            "transactions": mempool,
        }

        return snapshot

    def save_snapshot(
        self,
        snapshot: Dict[str, Any]
    ) -> Path:
        """
        Save a mempool snapshot as JSON.

        Returns:
            Path of the saved snapshot.
        """

        existing_snapshots = sorted(
            self.snapshot_dir.glob("snapshot_*.json")
        )

        snapshot_number = len(existing_snapshots) + 1

        filename = (
            f"snapshot_{snapshot_number:03d}.json"
        )

        filepath = self.snapshot_dir / filename

        with filepath.open(
            "w",
            encoding="utf-8"
        ) as file:
            json.dump(
                snapshot,
                file,
                indent=4
            )

        return filepath

    def collect_and_save(self) -> Path:
        """
        Collect the current mempool and save it.
        """

        snapshot = self.collect()

        filepath = self.save_snapshot(snapshot)

        return filepath


def main():
    print("Connecting to Bitcoin Core...")

    rpc = BitcoinRPC()

    try:
        blockchain_info = rpc.get_blockchain_info()

        print(
            f"Connected successfully."
        )

        print(
            f"Chain: {blockchain_info['chain']}"
        )

        collector = MempoolCollector(rpc)

        print("\nCollecting mempool...")

        snapshot = collector.collect()

        print(
            f"Mempool transactions: "
            f"{snapshot['transaction_count']}"
        )

        filepath = collector.save_snapshot(
            snapshot
        )

        print(
            f"\nSnapshot saved to:"
        )

        print(filepath)

    except Exception as error:
        print("\nCollector failed:")
        print(error)


if __name__ == "__main__":
    main()