"""EPA landfill importer (LMOP / RCRA-oriented)."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter, facility_from_seed
from haulbrokr_collector.importers.seed_data import facilities_for_state
from haulbrokr_collector.models import Facility, FacilityType


class EPALandfillImporter(SeedBackedImporter):
    """Import municipal solid waste landfills from EPA-oriented sources.

    When ``sources.epa_landfill_url`` is configured, a remote fetch can be
    plugged in. Offline runs use the curated seed catalog filtered to landfills.
    """

    name: ClassVar[str] = "epa_landfill"
    facility_type: ClassVar[FacilityType] = FacilityType.LANDFILL
    seed_facility_type = "landfill"
    default_materials: ClassVar[list[str]] = ["MSW"]
    default_confidence: ClassVar[float] = 0.9
    default_source: ClassVar[str] = "EPA LMOP"
    default_source_url: ClassVar[str] = "https://www.epa.gov/lmop"

    def enabled(self) -> bool:
        return self.config.importers.epa_landfill

    def fetch_for_state(self, state: str) -> list[Facility]:
        # Prefer remote URL when configured; fall back to seed data.
        url = self.config.sources.epa_landfill_url.strip()
        if url:
            return self._fetch_remote(state, url)
        rows = facilities_for_state(state, self.seed_facility_type)
        return [facility_from_seed(self, row) for row in rows]

    def _fetch_remote(self, state: str, url: str) -> list[Facility]:
        """Placeholder for live EPA dataset download.

        Production deployments can point ``epa_landfill_url`` at a CSV/JSON
        endpoint. Until then we keep deterministic seed-backed behavior.
        """
        # Intentionally fall back so offline / CI runs remain deterministic.
        _ = (state, url)
        rows = facilities_for_state(state, self.seed_facility_type)
        return [facility_from_seed(self, row) for row in rows]
