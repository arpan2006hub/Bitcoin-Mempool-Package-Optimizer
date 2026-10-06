import requests
from pathlib import Path
from typing import Any, Dict, List, Optional


NETWORK_PORTS = {
    "regtest": 18443,
    "testnet4": 48332,
}


class BitcoinRPC:
    def __init__(
        self,
        network: str = "regtest",
        host: str = "127.0.0.1",
        port: Optional[int] = None,
        cookie_file: Optional[str] = None,
        timeout: int = 30,
    ):
        self.network = network
        self.host = host

        if port is None:
            if network not in NETWORK_PORTS:
                raise ValueError(
                    f"Unknown network '{network}'. Supported networks: {list(NETWORK_PORTS.keys())}"
                )
            port = NETWORK_PORTS[network]

        self.port = port
        self.url = f"http://{host}:{port}"
        self.timeout = timeout
        self.request_id = 0

        # Bitcoin Core creates a separate directory/cookie per network.
        if cookie_file is None:
            cookie_file = (
                Path.home()
                / "AppData"
                / "Local"
                / "Bitcoin"
                / self.network
                / ".cookie"
            )

        self.cookie_file = Path(cookie_file)

    def _get_cookie_auth(self):
        """Read Bitcoin Core's RPC cookie."""

        if not self.cookie_file.exists():
            raise FileNotFoundError(
                f"Bitcoin Core RPC cookie not found at:\n"
                f"{self.cookie_file}\n\n"
                f"Make sure Bitcoin Core {self.network.capitalize()} is running."
            )

        cookie = self.cookie_file.read_text().strip()

        if ":" not in cookie:
            raise RuntimeError(
                "Invalid Bitcoin Core RPC cookie format."
            )

        username, password = cookie.split(":", 1)

        return username, password

    def call(
        self,
        method: str,
        params: Optional[List[Any]] = None
    ) -> Any:

        self.request_id += 1

        payload = {
            "jsonrpc": "1.0",
            "id": self.request_id,
            "method": method,
            "params": params or [],
        }

        auth = self._get_cookie_auth()

        try:
            response = requests.post(
                self.url,
                json=payload,
                auth=auth,
                timeout=self.timeout,
            )

            response.raise_for_status()

        except requests.exceptions.ConnectionError:
            raise ConnectionError(
                f"Could not connect to Bitcoin Core at {self.url}.\n"
                f"Make sure Bitcoin Core {self.network.capitalize()} is running."
            )

        except requests.exceptions.Timeout:
            raise TimeoutError(
                f"Bitcoin Core RPC request timed out after "
                f"{self.timeout} seconds."
            )

        except requests.exceptions.HTTPError as error:
            raise RuntimeError(
                f"Bitcoin Core returned an HTTP error: {error}"
            )

        result = response.json()

        if result.get("error") is not None:
            error = result["error"]

            raise RuntimeError(
                f"Bitcoin RPC error {error.get('code')}: "
                f"{error.get('message')}"
            )

        return result["result"]

    # --------------------------------------------------
    # Bitcoin Core RPC methods
    # --------------------------------------------------

    def get_blockchain_info(self) -> Dict[str, Any]:
        return self.call("getblockchaininfo")

    def get_mempool_info(self) -> Dict[str, Any]:
        return self.call("getmempoolinfo")

    def get_raw_mempool(
        self,
        verbose: bool = False
    ) -> Any:
        return self.call(
            "getrawmempool",
            [verbose]
        )

    def get_mempool_entry(
        self,
        txid: str
    ) -> Dict[str, Any]:
        return self.call(
            "getmempoolentry",
            [txid]
        )

    def get_mempool_ancestors(
        self,
        txid: str,
        verbose: bool = True
    ) -> Any:
        return self.call(
            "getmempoolancestors",
            [txid, verbose]
        )

    def get_mempool_descendants(
        self,
        txid: str,
        verbose: bool = True
    ) -> Any:
        return self.call(
            "getmempooldescendants",
            [txid, verbose]
        )

    def get_raw_transaction(
        self,
        txid: str,
        verbose: bool = True
    ) -> Any:
        return self.call(
            "getrawtransaction",
            [txid, verbose]
        )

    def decode_raw_transaction(
        self,
        raw_transaction: str
    ) -> Dict[str, Any]:
        return self.call(
            "decoderawtransaction",
            [raw_transaction]
        )

    def get_network_info(self) -> Dict[str, Any]:
        return self.call(
            "getnetworkinfo"
        )

    def test_connection(self) -> bool:
        try:
            self.get_blockchain_info()
            return True
        except Exception:
            return False