"""Asphalt recycling facility importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class AsphaltRecyclingImporter(SeedBackedImporter):
    name: ClassVar[str] = "asphalt_recycling"
    facility_type: ClassVar[FacilityType] = FacilityType.ASPHALT_RECYCLING
    seed_facility_type = "asphalt_recycling"
    default_materials: ClassVar[list[str]] = ["RAP", "asphalt millings", "asphalt"]
    default_confidence: ClassVar[float] = 0.84
    default_source: ClassVar[str] = "Industry Directory / Asphalt Recycling"

    def enabled(self) -> bool:
        return self.config.importers.asphalt_recycling
