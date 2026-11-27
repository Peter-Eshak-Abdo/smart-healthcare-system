from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

LEVEL_MAP = {
    "major": "major",
    "moderate": "moderate",
    "minor": "minor",
}


def import_ddinter_csv(
    *,
    ddinter_csv: Path,
    mapping_csv: Path,
    manifest_out: Path | None = None,
) -> dict[str, object]:
    name_to_ing: dict[str, str] = {}
    with mapping_csv.open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            name_to_ing[row["ddinter_name"].strip().lower()] = row["ingredient_code"].strip()

    imported: list[tuple[str, str, str, str]] = []
    unmapped: list[str] = []

    with ddinter_csv.open("r", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            lvl = LEVEL_MAP.get(row.get("Level", "").strip().lower())
            if not lvl:
                # Unknown levels skipped; contraindicated comes only from curated seed rules
                continue
            a_raw = row.get("Drug_A", "").strip().lower()
            b_raw = row.get("Drug_B", "").strip().lower()
            ing_a = name_to_ing.get(a_raw)
            ing_b = name_to_ing.get(b_raw)
            if not ing_a or not ing_b:
                if not ing_a:
                    unmapped.append(a_raw)
                if not ing_b:
                    unmapped.append(b_raw)
                continue
            pair = (min(ing_a, ing_b), max(ing_a, ing_b))
            if pair[0] != pair[1]:
                imported.append((pair[0], pair[1], lvl, row.get("DDInterID", "").strip()))

    digest = hashlib.sha256(ddinter_csv.read_bytes()).hexdigest()
    manifest = {
        "imported_count": len(imported),
        "unmapped_names": sorted(set(unmapped)),
        "source_sha256": digest,
    }
    if manifest_out is not None:
        manifest_out.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate & summarize DDInter 2.0 CSV import")
    parser.add_argument("--ddinter-csv", type=Path, required=True)
    parser.add_argument("--mapping-csv", type=Path, required=True)
    parser.add_argument("--manifest-out", type=Path, required=False)
    args = parser.parse_args()
    manifest = import_ddinter_csv(
        ddinter_csv=args.ddinter_csv,
        mapping_csv=args.mapping_csv,
        manifest_out=args.manifest_out,
    )
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
