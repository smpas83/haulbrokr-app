"""Concrete recycling facility importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class ConcreteRecyclingImporter(SeedBackedImporter):
    name: ClassVar[str] = "concrete_recycling"
    facility_type: ClassVar[FacilityType] = FacilityType.CONCRETE_RECYCLING
    seed_facility_type = "concrete_recycling"
    default_materials: ClassVar[list[str]] = ["concrete", "rebar", "brick", "block"]
    default_confidence: ClassVar[float] = 0.85
    default_source: ClassVar[str] = "Industry Directory / Concrete Recycling"

    def enabled(self) -> bool:
        return self.config.importers.concrete_recycling
