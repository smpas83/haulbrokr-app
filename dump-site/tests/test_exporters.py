"""Tests for exporters."""

from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path
from unittest.mock import MagicMock, patch

from haulbrokr_collector.config import ExportConfig, SupabaseConfig
from haulbrokr_collector.exporters import FacilityExporter, facilities_from_export_rows
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType


def _sample() -> list[Facility]:
    return [
        Facility(
            name="Test Landfill",
            address="1 Main St",
            city="Town",
            county="County",
            state="CA",
            zip="90001",
            latitude=34.0,
            longitude=-118.0,
            phone="555-0100",
            accepted_materials=["MSW", "C&D"],
            facility_type=FacilityType.LANDFILL,
            ownership=OwnershipType.PUBLIC,
            source="test",
            confidence_score=0.9,
        )
    ]


def test_export_all_formats(tmp_path: Path) -> None:
    exporter = FacilityExporter(tmp_path)
    paths = exporter.export(_sample(), formats=["csv", "excel", "sqlite", "supabase"])
    assert paths["csv"].exists()
    assert paths["excel"].exists()
    assert paths["sqlite"].exists()
    assert paths["supabase"].exists()

    with paths["csv"].open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    assert rows[0]["name"] == "Test Landfill"
    assert rows[0]["public_private"] == "public"

    conn = sqlite3.connect(paths["sqlite"])
    count = conn.execute("SELECT COUNT(*) FROM facilities").fetchone()[0]
    conn.close()
    assert count == 1

    with paths["supabase"].open(encoding="utf-8") as handle:
        supabase_rows = list(csv.DictReader(handle))
    assert supabase_rows[0]["is_public"] == "true"
    assert "MSW" in supabase_rows[0]["accepted_materials"]


def test_facilities_from_export_rows_roundtrip(tmp_path: Path) -> None:
    exporter = FacilityExporter(tmp_path)
    original = _sample()
    path = exporter.to_csv(original)
    with path.open(encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    restored = facilities_from_export_rows(rows)
    assert len(restored) == 1
    assert restored[0].name == "Test Landfill"
    assert set(restored[0].accepted_materials) == {"MSW", "C&D"}


def test_supabase_api_skipped_without_credentials(tmp_path: Path) -> None:
    exporter = FacilityExporter(
        tmp_path,
        supabase_config=SupabaseConfig(enabled=False),
    )
    assert exporter.to_supabase_api(_sample()) is None


def test_supabase_api_upsert_mocked(tmp_path: Path) -> None:
    mock_client = MagicMock()
    mock_table = MagicMock()
    mock_client.table.return_value = mock_table
    mock_table.upsert.return_value.execute.return_value = MagicMock()

    with patch(
        "supabase.create_client",
        return_value=mock_client,
    ):
        exporter = FacilityExporter(
            tmp_path,
            ExportConfig(supabase_upsert=True),
            SupabaseConfig(
                url="https://example.supabase.co",
                key="test-key",
                table="dump_sites",
                enabled=True,
            ),
        )
        receipt = exporter.to_supabase_api(_sample())

    assert receipt is not None and receipt.exists()
    data = json.loads(receipt.read_text(encoding="utf-8"))
    assert data["rows"] == 1
    assert data["table"] == "dump_sites"
    mock_client.table.assert_called_with("dump_sites")
    mock_table.upsert.assert_called()
