import json
import subprocess
from typing import Any, List


def bitcoin_cli(
    *args: str
) -> Any:

    command = [
        "bitcoin-cli",
        "-regtest",
        *args,
    ]

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=True,
    )

    output = result.stdout.strip()

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return output


def get_mempool_cluster(
    txid: str
) -> Any:

    return bitcoin_cli(
        "getmempoolcluster",
        txid,
    )


def get_mempool_entry(
    txid: str
) -> Any:

    return bitcoin_cli(
        "getmempoolentry",
        txid,
    )


def main():

    txid = input(
        "Enter a transaction ID: "
    ).strip()

    print("\nBitcoin Core mempool entry:")
    entry = get_mempool_entry(txid)

    print(
        json.dumps(
            entry,
            indent=4
        )
    )

    print(
        "\nBitcoin Core cluster:"
    )

    try:

        cluster = get_mempool_cluster(
            txid
        )

        print(
            json.dumps(
                cluster,
                indent=4
            )
        )

    except subprocess.CalledProcessError as error:

        print(
            "\ngetmempoolcluster is not "
            "available or failed."
        )

        print(
            error.stderr
        )


if __name__ == "__main__":
    main()