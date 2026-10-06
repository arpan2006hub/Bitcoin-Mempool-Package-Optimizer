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
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip()
        )

    output = result.stdout.strip()

    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return output


def test_package(
    raw_transactions: List[str]
) -> Any:

    package_json = json.dumps(
        raw_transactions
    )

    return bitcoin_cli(
        "testmempoolaccept",
        package_json,
    )


def main():

    print(
        "Enter raw transactions "
        "in topological order."
    )

    print(
        "Parent transactions must come "
        "before children."
    )

    raw_transactions = []

    while True:

        rawtx = input(
            "Raw transaction "
            "(blank to finish): "
        ).strip()

        if not rawtx:
            break

        raw_transactions.append(
            rawtx
        )

    if not raw_transactions:
        print(
            "No transactions provided."
        )
        return

    result = test_package(
        raw_transactions
    )

    print(
        "\nBitcoin Core package validation:"
    )

    print(
        json.dumps(
            result,
            indent=4
        )
    )


if __name__ == "__main__":
    main()