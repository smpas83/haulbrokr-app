"""Export facilities to CSV, Excel, SQLite, and Supabase-ready CSV."""

from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path
from typing import Any, Literal

from openpyxl import Workbook

from haulbrokr_collector.config import CollectorConfig, ExportConfig
from haulbrokr_collector.logging_setup import get_logger
from haulbrokr_collector.models import Facility

logger = get_logger("exporters")

ExportFormat = Literal["csv", "excel", "sqlite", "supabase"]

EXPORT_COLUMNS: list[str] = [
    "id",
    "name",
    "address",
    "city",
    "county",
    "state",
    "zip",
    "latitude",
    "longitude",
    "phone",
    "website",
    "email",
    "operator",
    "permit_number",
    "accepted_materials",
    "facility_type",
    "public_private",
    "source",
    "source_url",
    "last_verified",
    "confidence_score",
    "collected_at",
]

SUPABASE_COLUMNS: list[str] = [
    "id",
    "name",
    "address",
    "city",
    "county",
    "state",
    "zip",
    "latitude",
    "longitude",
    "phone",
    "website",
    "email",
    "operator",
    "permit_number",
    "accepted_materials",
    "facility_type",
    "ownership",
    "is_public",
    "source",
    "source_url",
    "last_verified",
    "confidence_score",
    "collected_at",
]


class FacilityExporter:
    """Write facility records to one or more export formats."""

    def __init__(
        self,
        output_dir: Path,
        export_config: ExportConfig | None = None,
    ) -> None:
        self.output_dir = output_dir
        self.export_config = export_config or ExportConfig()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_config(cls, config: CollectorConfig) -> FacilityExporter:
        return cls(config.output_path, config.export)

    def export(
        self,
        facilities: list[Facility],
        formats: list[str] | None = None,
        basename: str = "facilities",
    ) -> dict[str, Path]:
        selected = formats or list(self.export_config.default_formats)
        written: dict[str, Path] = {}
        for fmt in selected:
            normalized = fmt.strip().lower()
            if normalized in {"xlsx", "xls"}:
                normalized = "excel"
            if normalized == "csv":
                written["csv"] = self.to_csv(facilities, basename)
            elif normalized == "excel":
                written["excel"] = self.to_excel(facilities, basename)
            elif normalized == "sqlite":
                written["sqlite"] = self.to_sqlite(facilities, basename)
            elif normalized == "supabase":
                written["supabase"] = self.to_supabase_csv(facilities, basename)
            else:
                msg = f"Unsupported export format: {fmt}"
                raise ValueError(msg)
        return written

    def to_csv(self, facilities: list[Facility], basename: str = "facilities") -> Path:
        path = self.output_dir / f"{basename}.csv"
        rows = [f.to_export_row() for f in facilities]
        with path.open("w", encoding=self.export_config.csv_encoding, newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=EXPORT_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        logger.info("Wrote CSV (%s rows) → %s", len(rows), path)
        return path

    def to_excel(self, facilities: list[Facility], basename: str = "facilities") -> Path:
        path = self.output_dir / f"{basename}.xlsx"
        workbook = Workbook()
        sheet = workbook.active
        assert sheet is not None
        sheet.title = self.export_config.excel_sheet_name
        sheet.append(EXPORT_COLUMNS)
        for facility in facilities:
            row = facility.to_export_row()
            sheet.append([row.get(col) for col in EXPORT_COLUMNS])
        workbook.save(path)
        logger.info("Wrote Excel (%s rows) → %s", len(facilities), path)
        return path

    def to_sqlite(self, facilities: list[Facility], basename: str = "facilities") -> Path:
        path = self.output_dir / f"{basename}.sqlite3"
        table = self.export_config.sqlite_table
        if path.exists():
            path.unlink()
        connection = sqlite3.connect(path)
        try:
            connection.execute(
                f"""
                CREATE TABLE {table} (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    address TEXT,
                    city TEXT,
                    county TEXT,
                    state TEXT NOT NULL,
                    zip TEXT,
                    latitude REAL,
                    longitude REAL,
                    phone TEXT,
                    website TEXT,
                    email TEXT,
                    operator TEXT,
                    permit_number TEXT,
                    accepted_materials TEXT,
                    facility_type TEXT,
                    public_private TEXT,
                    source TEXT,
                    source_url TEXT,
                    last_verified TEXT,
                    confidence_score REAL,
                    collected_at TEXT
                )
                """
            )
            connection.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{table}_state ON {table}(state)"
            )
            connection.execute(
                f"CREATE INDEX IF NOT EXISTS idx_{table}_type ON {table}(facility_type)"
            )
            insert_sql = f"""
                INSERT INTO {table} (
                    id, name, address, city, county, state, zip,
                    latitude, longitude, phone, website, email, operator,
                    permit_number, accepted_materials, facility_type,
                    public_private, source, source_url, last_verified,
                    confidence_score, collected_at
                ) VALUES (
                    :id, :name, :address, :city, :county, :state, :zip,
                    :latitude, :longitude, :phone, :website, :email, :operator,
                    :permit_number, :accepted_materials, :facility_type,
                    :public_private, :source, :source_url, :last_verified,
                    :confidence_score, :collected_at
                )
            """
            connection.executemany(insert_sql, [f.to_export_row() for f in facilities])
            connection.commit()
        finally:
            connection.close()
        logger.info("Wrote SQLite (%s rows) → %s", len(facilities), path)
        return path

    def to_supabase_csv(
        self,
        facilities: list[Facility],
        basename: str = "facilities",
    ) -> Path:
        filename = self.export_config.supabase_filename
        if basename != "facilities":
            filename = f"{basename}_supabase.csv"
        path = self.output_dir / filename
        rows = [f.to_supabase_row() for f in facilities]
        with path.open("w", encoding=self.export_config.csv_encoding, newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=SUPABASE_COLUMNS, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                serialized = dict(row)
                # Supabase CSV import expects JSON arrays as text for jsonb columns.
                materials = serialized.get("accepted_materials", [])
                serialized["accepted_materials"] = json.dumps(materials)
                serialized["is_public"] = (
                    "true" if serialized.get("is_public") else "false"
                )
                writer.writerow(serialized)
        logger.info("Wrote Supabase CSV (%s rows) → %s", len(rows), path)
        return path


def facilities_from_export_rows(rows: list[dict[str, Any]]) -> list[Facility]:
    """Rehydrate Facility models from persisted export/JSONL rows."""
    facilities: list[Facility] = []
    for row in rows:
        materials = row.get("accepted_materials", [])
        if isinstance(materials, str):
            if materials.startswith("["):
                try:
                    materials = json.loads(materials)
                except json.JSONDecodeError:
                    materials = [m for m in materials.split("|") if m]
            else:
                materials = [m for m in materials.split("|") if m]
        ownership = row.get("ownership") or row.get("public_private") or "unknown"
        payload = {
            "id": row.get("id"),
            "name": row["name"],
            "address": row.get("address", ""),
            "city": row.get("city", ""),
            "county": row.get("county", ""),
            "state": row["state"],
            "zip": row.get("zip", ""),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "phone": row.get("phone", ""),
            "website": row.get("website", ""),
            "email": row.get("email", ""),
            "operator": row.get("operator", ""),
            "permit_number": row.get("permit_number", ""),
            "accepted_materials": materials,
            "facility_type": row.get("facility_type", "other"),
            "ownership": ownership,
            "source": row.get("source", ""),
            "source_url": row.get("source_url", ""),
            "last_verified": row.get("last_verified") or None,
            "confidence_score": row.get("confidence_score", 0.5),
        }
        if row.get("collected_at"):
            payload["collected_at"] = row["collected_at"]
        # Drop empty id so a new UUID is generated only when missing.
        if not payload.get("id"):
            payload.pop("id", None)
        facilities.append(Facility.model_validate(payload))
    return facilities
