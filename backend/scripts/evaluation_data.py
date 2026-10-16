"""Strict readers for saved scans; never synthesize missing measurements."""
import csv
import hashlib
import json
import math
from pathlib import Path

FACTORS = ("V", "O", "U", "D", "M")
PAPER_WEIGHTS = (0.35, 0.15, 0.20, 0.15, 0.15)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def records_from(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("dependencies", "results"):
            if isinstance(data.get(key), list):
                return data[key]
    raise ValueError("Expected a dependency list or an object with dependencies/results")


def load_records(path):
    path = Path(path)
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as stream:
            return list(csv.DictReader(stream))
    return records_from(json.loads(path.read_text(encoding="utf-8-sig")))


def load_features(source):
    source = Path(source)
    if not source.exists():
        raise ValueError(f"Feature data not found: {source}. Real saved data is required.")
    paths = sorted(p for p in source.iterdir() if p.suffix.lower() in (".json", ".csv")) if source.is_dir() else [source]
    rows, provenance = [], []
    for path in paths:
        records = load_records(path)
        if not records:
            raise ValueError(f"Empty dataset: {path}")
        provenance.append({"path": str(path.resolve()), "sha256": sha256(path), "rows": len(records)})
        for index, record in enumerate(records):
            values = []
            for factor in FACTORS:
                raw = record.get(factor, record.get(f"factor_{factor}"))
                try:
                    value = float(raw)
                except (TypeError, ValueError):
                    raise ValueError(f"{path}, row {index + 1}: missing/invalid {factor}") from None
                if not math.isfinite(value) or not 0 <= value <= 1:
                    raise ValueError(f"{path}, row {index + 1}: {factor} must be finite and in [0, 1]")
                values.append(value)
            risk = record.get("R", record.get("composite_risk_R"))
            if risk is not None and risk != "":
                risk = float(risk)
                if not math.isfinite(risk) or not 0 <= risk <= 1:
                    raise ValueError(f"{path}, row {index + 1}: R must be in [0, 1]")
            else:
                risk = None
            rows.append({"source": str(path.resolve()), "row": index + 1,
                         "package": record.get("package_name") or f"{record.get('name', 'unknown')}@{record.get('version', 'unknown')}",
                         "features": values, "R": risk,
                         "paper_equation_R": sum(w * v for w, v in zip(PAPER_WEIGHTS, values))})
    if not rows:
        raise ValueError("No feature data found. Synthetic fallback is disabled.")
    return rows, provenance


def write_csv(path, rows, fields):
    with Path(path).open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
