"""Dirt / clean-fill disposal site importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class DirtDisposalImporter(SeedBackedImporter):
    name: ClassVar[str] = "dirt_disposal"
    facility_type: ClassVar[FacilityType] = FacilityType.DIRT_DISPOSAL
    seed_facility_type = "dirt_disposal"
    default_materials: ClassVar[list[str]] = ["clean dirt", "fill", "soil"]
    default_confidence: ClassVar[float] = 0.8
    default_source: ClassVar[str] = "State Agency / Dirt Disposal Registry"

    def enabled(self) -> bool:
        return self.config.importers.dirt_disposal
