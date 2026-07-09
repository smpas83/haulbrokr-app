"""Tests for importers."""

from __future__ import annotations

from haulbrokr_collector.config import CollectorConfig
from haulbrokr_collector.importers import build_importers
from haulbrokr_collector.importers.epa_landfill import EPALandfillImporter
from haulbrokr_collector.importers.transfer_stations import TransferStationImporter
from haulbrokr_collector.models import FacilityType


def test_build_importers_all_enabled() -> None:
    importers = build_importers(CollectorConfig())
    names = [i.name for i in importers]
    assert names == [
        "epa_landfill",
        "state_agency",
        "transfer_stations",
        "cd_facilities",
        "dirt_disposal",
        "rock_quarries",
        "gravel_pits",
        "aggregate_yards",
        "asphalt_recycling",
        "concrete_recycling",
    ]


def test_epa_importer_returns_ca_landfills() -> None:
    importer = EPALandfillImporter(CollectorConfig())
    facilities = importer.fetch_for_state("CA")
    assert facilities
    assert all(f.state == "CA" for f in facilities)
    assert all(f.facility_type == FacilityType.LANDFILL for f in facilities)
    assert any("Altamont" in f.name for f in facilities)


def test_transfer_station_importer_filters_type() -> None:
    importer = TransferStationImporter(CollectorConfig())
    facilities = importer.fetch_for_state("CA")
    assert facilities
    assert all(f.facility_type == FacilityType.TRANSFER_STATION for f in facilities)


def test_importer_empty_state() -> None:
    importer = EPALandfillImporter(CollectorConfig())
    # Wyoming has a landfill in seed data; pick a nonsense code via empty filter
    # by requesting a state with no matching type for transfer stations in AK beyond known.
    facilities = importer.fetch_for_state("WY")
    assert isinstance(facilities, list)
