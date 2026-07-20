"""Aggregate yard importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class AggregateYardImporter(SeedBackedImporter):
    name: ClassVar[str] = "aggregate_yards"
    facility_type: ClassVar[FacilityType] = FacilityType.AGGREGATE_YARD
    seed_facility_type = "aggregate_yard"
    default_materials: ClassVar[list[str]] = ["aggregate", "sand", "gravel", "base rock"]
    default_confidence: ClassVar[float] = 0.84
    default_source: ClassVar[str] = "Industry Directory / Aggregate Yards"

    def enabled(self) -> bool:
        return self.config.importers.aggregate_yards
