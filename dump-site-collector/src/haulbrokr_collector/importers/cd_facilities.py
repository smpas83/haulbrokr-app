"""Construction & demolition (C&D) facility importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class CDFacilityImporter(SeedBackedImporter):
    name: ClassVar[str] = "cd_facilities"
    facility_type: ClassVar[FacilityType] = FacilityType.CD_FACILITY
    seed_facility_type = "cd_facility"
    default_materials: ClassVar[list[str]] = ["C&D", "wood", "concrete", "asphalt"]
    default_confidence: ClassVar[float] = 0.85
    default_source: ClassVar[str] = "State Agency / C&D Registry"

    def enabled(self) -> bool:
        return self.config.importers.cd_facilities
