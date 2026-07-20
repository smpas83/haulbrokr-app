"""Tests for exporters."""

from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

from haulbrokr_collector.exporters import FacilityExporter
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
