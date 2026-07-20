"""Export facilities to CSV, Excel, SQLite, and Supabase (CSV + live API)."""

from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path
from typing import Any, Literal

from openpyxl import Workbook

from haulbrokr_collector.config import CollectorConfig, ExportConfig, SupabaseConfig
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
        supabase_config: SupabaseConfig | None = None,
    ) -> None:
        self.output_dir = output_dir
        self.export_config = export_config or ExportConfig()
        self.supabase_config = supabase_config or SupabaseConfig()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_config(cls, config: CollectorConfig) -> FacilityExporter:
        return cls(config.output_path, config.export, config.supabase)

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
                # Optionally push live when credentials are configured.
                if self.supabase_config.enabled:
                    pushed = self.to_supabase_api(facilities)
                    if pushed is not None:
                        written["supabase_api"] = pushed
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

    def to_supabase_api(self, facilities: list[Facility]) -> Path | None:
        """Upsert facilities into a live Supabase table when credentials exist.

        Returns a small JSON receipt path on success, or None when skipped.
        """
        url = self.supabase_config.url.strip()
        key = self.supabase_config.key.strip()
        table = self.supabase_config.table or self.export_config.supabase_table
        if not url or not key:
            logger.info("Supabase API push skipped (missing SUPABASE_URL / SUPABASE_KEY)")
            return None

        try:
            from supabase import create_client
        except ImportError as exc:
            msg = "supabase package is required for live Supabase export"
            raise RuntimeError(msg) from exc

        client = create_client(url, key)
        payload = [f.to_supabase_row() for f in facilities]
        # Ensure JSON-serializable materials lists.
        for row in payload:
            if not isinstance(row.get("accepted_materials"), list):
                row["accepted_materials"] = []

        batch_size = 200
        upserted = 0
        for start in range(0, len(payload), batch_size):
            batch = payload[start : start + batch_size]
            query = client.table(table)
            if self.export_config.supabase_upsert:
                query.upsert(batch).execute()
            else:
                query.insert(batch).execute()
            upserted += len(batch)

        receipt = self.output_dir / "supabase_push_receipt.json"
        receipt.write_text(
            json.dumps(
                {
                    "table": table,
                    "rows": upserted,
                    "url": url,
                    "mode": "upsert" if self.export_config.supabase_upsert else "insert",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        logger.info("Pushed %s rows to Supabase table %s", upserted, table)
        return receipt


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
