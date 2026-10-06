from src.rpc import BitcoinRPC


# Change these after checking your Bitcoin Core configuration.
rpc = BitcoinRPC(
    host="127.0.0.1",
    port=18443,
)


def main():
    print("Connecting to Bitcoin Core...")

    try:
        blockchain = rpc.get_blockchain_info()

        print("\nConnection successful!")
        print(f"Chain: {blockchain['chain']}")
        print(f"Blocks: {blockchain['blocks']}")
        print(f"Headers: {blockchain['headers']}")

        mempool = rpc.get_mempool_info()

        print("\nMempool:")
        print(f"Transactions: {mempool['size']}")
        print(f"Bytes: {mempool['bytes']}")

    except Exception as error:
        print("\nConnection failed:")
        print(error)


if __name__ == "__main__":
    main()