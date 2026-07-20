"""Gravel pit importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class GravelPitImporter(SeedBackedImporter):
    name: ClassVar[str] = "gravel_pits"
    facility_type: ClassVar[FacilityType] = FacilityType.GRAVEL_PIT
    seed_facility_type = "gravel_pit"
    default_materials: ClassVar[list[str]] = ["gravel", "sand"]
    default_confidence: ClassVar[float] = 0.82
    default_source: ClassVar[str] = "State Mining / Gravel Pit Registry"

    def enabled(self) -> bool:
        return self.config.importers.gravel_pits
