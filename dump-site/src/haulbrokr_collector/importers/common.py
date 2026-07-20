"""Shared helpers for seed-backed importers."""

from __future__ import annotations

from typing import Any

from haulbrokr_collector.importers.base import BaseImporter
from haulbrokr_collector.importers.seed_data import facilities_for_state
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType


def ownership_from_str(value: str | None) -> OwnershipType:
    if not value:
        return OwnershipType.UNKNOWN
    normalized = value.strip().lower()
    if normalized == "public":
        return OwnershipType.PUBLIC
    if normalized == "private":
        return OwnershipType.PRIVATE
    return OwnershipType.UNKNOWN


def facility_from_seed(importer: BaseImporter, row: dict[str, Any]) -> Facility:
    return importer._facility(
        name=str(row["name"]),
        state=str(row["state"]),
        address=str(row.get("address", "")),
        city=str(row.get("city", "")),
        county=str(row.get("county", "")),
        zip_code=str(row.get("zip", "")),
        latitude=row.get("latitude"),
        longitude=row.get("longitude"),
        phone=str(row.get("phone", "")),
        website=str(row.get("website", "")),
        email=str(row.get("email", "")),
        operator=str(row.get("operator", "")),
        permit_number=str(row.get("permit_number", "")),
        accepted_materials=list(row.get("accepted_materials") or []),
        facility_type=FacilityType(str(row.get("facility_type", importer.facility_type.value))),
        ownership=ownership_from_str(row.get("ownership")),
        source=str(row.get("source") or importer.default_source),
        source_url=str(row.get("source_url") or importer.default_source_url),
        confidence_score=float(row.get("confidence_score", importer.default_confidence)),
    )


class SeedBackedImporter(BaseImporter):
    """Importer that filters the shared seed catalog by facility type."""

    seed_facility_type: str = "other"

    def fetch_for_state(self, state: str) -> list[Facility]:
        rows = facilities_for_state(state, self.seed_facility_type)
        return [facility_from_seed(self, row) for row in rows]
