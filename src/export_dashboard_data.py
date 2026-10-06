import json
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional


def load_json(filepath: Path) -> Optional[Any]:
    if not filepath.exists():
        return None
    try:
        with filepath.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load {filepath}: {e}")
        return None


def save_json(filepath: Path, data: Any) -> None:
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


def export_data(
    project_root: Optional[Path] = None,
    dest_dir: Optional[Path] = None
) -> None:
    if project_root is None:
        project_root = Path(__file__).resolve().parent.parent

    if dest_dir is None:
        dest_dir = project_root / "dashboard" / "public" / "data"

    dest_dir.mkdir(parents=True, exist_ok=True)
    snapshots_dir = project_root / "data" / "snapshots"
    results_dir = project_root / "data" / "results"

    print(f"Exporting dashboard data from {project_root} to {dest_dir}...")

    # 1. Snapshots
    all_snapshots = sorted(snapshots_dir.glob("snapshot_*.json"))
    all_analyses = sorted(results_dir.glob("analysis_snapshot_*.json"))

    history: List[Dict[str, Any]] = []

    # Copy individual snapshots and analyses for historical browsing
    snapshots_dest_dir = dest_dir / "snapshots"
    analyses_dest_dir = dest_dir / "analyses"
    snapshots_dest_dir.mkdir(parents=True, exist_ok=True)
    analyses_dest_dir.mkdir(parents=True, exist_ok=True)

    for snap_path in all_snapshots:
        snap_data = load_json(snap_path)
        if not snap_data:
            continue

        shutil.copy2(snap_path, snapshots_dest_dir / snap_path.name)

        # Corresponding analysis file
        analysis_filename = f"analysis_{snap_path.name}"
        analysis_path = results_dir / analysis_filename
        analysis_data = load_json(analysis_path)
        if analysis_data:
            shutil.copy2(analysis_path, analyses_dest_dir / analysis_filename)

        # Compute summary metrics for history
        tx_count = snap_data.get("transaction_count", len(snap_data.get("transactions", {})))
        txs = snap_data.get("transactions", {})

        total_vsize = 0
        total_fee_sat = 0

        for txid, tx in txs.items():
            vsize = int(tx.get("vsize", 0))
            total_vsize += vsize

            fees = tx.get("fees", {})
            base_fee_btc = float(fees.get("base", 0.0))
            fee_sat = round(base_fee_btc * 100_000_000)
            total_fee_sat += fee_sat

        avg_feerate = round(total_fee_sat / total_vsize, 2) if total_vsize > 0 else 0.0

        history.append({
            "id": snap_path.stem.replace("snapshot_", ""),
            "name": f"Snapshot {snap_path.stem.replace('snapshot_', '')}",
            "snapshot_file": snap_path.name,
            "analysis_file": analysis_filename if analysis_data else None,
            "snapshot_time": snap_data.get("snapshot_time"),
            "transaction_count": tx_count,
            "total_vsize": total_vsize,
            "total_fee_sat": total_fee_sat,
            "avg_feerate_sat_vb": avg_feerate,
        })

    save_json(dest_dir / "snapshots_history.json", history)
    print(f"Copied {len(all_snapshots)} snapshots into history.")

    # 2. Latest snapshot and analysis
    if all_snapshots:
        latest_snapshot_path = all_snapshots[-1]
        shutil.copy2(latest_snapshot_path, dest_dir / "snapshot.json")
        print(f"Exported latest snapshot: {latest_snapshot_path.name} -> snapshot.json")
    else:
        print("Warning: No snapshots found.")

    if all_analyses:
        latest_analysis_path = all_analyses[-1]
        shutil.copy2(latest_analysis_path, dest_dir / "analysis.json")
        print(f"Exported latest analysis: {latest_analysis_path.name} -> analysis.json")
    else:
        print("Warning: No analysis files found.")

    # 3. Algorithm results
    files_to_copy = [
        ("baseline_result.json", "baseline.json"),
        ("optimizer_result.json", "optimizer.json"),
        ("improved_optimizer_result.json", "improved.json"),
        ("simulation_results.json", "simulation.json"),
        ("algorithm_comparison.json", "comparison.json"),
        ("packages.json", "packages.json"),
        ("dependency_graph.json", "graph.json"),
    ]

    for src_name, target_name in files_to_copy:
        src_file = results_dir / src_name
        if src_file.exists():
            shutil.copy2(src_file, dest_dir / target_name)
            print(f"Exported {src_name} -> {target_name}")
        else:
            print(f"Note: {src_name} does not exist yet. Skipped.")

    print("Dashboard data export completed successfully!\n")


if __name__ == "__main__":
    export_data()
