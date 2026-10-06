from src.rpc import BitcoinRPC
from src.collector import MempoolCollector


def main():
    print("Testing Mempool Collector...\n")

    rpc = BitcoinRPC()

    collector = MempoolCollector(rpc)

    snapshot = collector.collect()

    print(
        f"Transactions collected: "
        f"{snapshot['transaction_count']}"
    )

    print(
        f"Snapshot time: "
        f"{snapshot['snapshot_time']}"
    )

    filepath = collector.save_snapshot(
        snapshot
    )

    print(
        f"Snapshot saved to: {filepath}"
    )


if __name__ == "__main__":
    main()