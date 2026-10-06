"""
Lightweight FastAPI server that bridges the React dashboard to the Python
research pipeline.  It exposes a single endpoint:

    POST /api/refresh
        Runs export_dashboard_data.export_data() synchronously, then
        returns a JSON payload with the paths of files that were updated.

    GET /api/status
        Returns metadata about the latest snapshot and result files so the
        frontend can display how fresh the data is without doing a full
        refresh.

Start with:
    python -m src.dashboard_api
or:
    uvicorn src.dashboard_api:app --reload --port 5174
"""

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Mempool Optimizer Dashboard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    # Allow the Vite dev server (any localhost port) and same-origin production
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:4173", "http://127.0.0.1:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = PROJECT_ROOT / "data" / "results"
SNAPSHOTS_DIR = PROJECT_ROOT / "data" / "snapshots"
PUBLIC_DATA_DIR = PROJECT_ROOT / "dashboard" / "public" / "data"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _latest_file(directory: Path, pattern: str) -> Path | None:
    files = sorted(directory.glob(pattern))
    return files[-1] if files else None


def _mtime_iso(path: Path | None) -> str | None:
    if path is None or not path.exists():
        return None
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/status")
def get_status():
    """Return freshness metadata — no heavy I/O."""
    latest_snapshot = _latest_file(SNAPSHOTS_DIR, "snapshot_*.json")
    latest_analysis = _latest_file(RESULTS_DIR, "analysis_snapshot_*.json")
    public_snapshot = PUBLIC_DATA_DIR / "snapshot.json"

    return {
        "latest_snapshot": latest_snapshot.name if latest_snapshot else None,
        "latest_snapshot_mtime": _mtime_iso(latest_snapshot),
        "latest_analysis": latest_analysis.name if latest_analysis else None,
        "latest_analysis_mtime": _mtime_iso(latest_analysis),
        "public_snapshot_mtime": _mtime_iso(public_snapshot),
        "is_stale": (
            latest_snapshot is not None
            and public_snapshot.exists()
            and latest_snapshot.stat().st_mtime > public_snapshot.stat().st_mtime + 1
        ),
    }


@app.post("/api/refresh")
def trigger_refresh():
    """
    Run export_dashboard_data synchronously in-process, then return a summary
    of what changed.  Runs in the same interpreter so no PATH issues on Windows.
    """
    try:
        # Import here so we don't pay the cost on every module load
        from src.export_dashboard_data import export_data  # noqa: PLC0415

        export_data()

        latest_snapshot = _latest_file(SNAPSHOTS_DIR, "snapshot_*.json")
        latest_analysis = _latest_file(RESULTS_DIR, "analysis_snapshot_*.json")

        return {
            "success": True,
            "refreshed_at": datetime.now(tz=timezone.utc).isoformat(),
            "latest_snapshot": latest_snapshot.name if latest_snapshot else None,
            "latest_analysis": latest_analysis.name if latest_analysis else None,
        }
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# Entry-point when run as a module
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.dashboard_api:app",
        host="127.0.0.1",
        port=5174,
        reload=True,
        reload_dirs=[str(PROJECT_ROOT / "src")],
    )
