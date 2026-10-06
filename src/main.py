from rpc import BitcoinRPC


def main():
    try:
        # Create Bitcoin Core RPC client
        rpc = BitcoinRPC(
            host="127.0.0.1",
            port=18443,
        )

        # Get blockchain information
        blockchain_info = rpc.get_blockchain_info()

        # Get mempool information
        mempool_info = rpc.get_mempool_info()

        # Extract required values
        chain = blockchain_info["chain"]
        block_height = blockchain_info["blocks"]
        mempool_transactions = mempool_info["size"]

        # Bitcoin Core reports mempool size in bytes.
        # Convert bytes to MB.
        mempool_size_mb = mempool_info["bytes"] / (1024 * 1024)

        print("Bitcoin Core connection successful")
        print()
        print(f"Chain: {chain}")
        print(f"Block height: {block_height}")
        print(f"Mempool transactions: {mempool_transactions}")
        print(f"Mempool size: {mempool_size_mb:.2f} MB")

    except Exception as error:
        print("Bitcoin Core connection failed:")
        print(error)


if __name__ == "__main__":
    main()

