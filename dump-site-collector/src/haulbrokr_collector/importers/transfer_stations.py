"""Transfer station importer."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter
from haulbrokr_collector.models import FacilityType


class TransferStationImporter(SeedBackedImporter):
    name: ClassVar[str] = "transfer_stations"
    facility_type: ClassVar[FacilityType] = FacilityType.TRANSFER_STATION
    seed_facility_type = "transfer_station"
    default_materials: ClassVar[list[str]] = ["MSW", "recyclables"]
    default_confidence: ClassVar[float] = 0.85
    default_source: ClassVar[str] = "State Agency / Transfer Station Registry"

    def enabled(self) -> bool:
        return self.config.importers.transfer_stations
