"""Facility importer registry."""

from __future__ import annotations

from haulbrokr_collector.config import CollectorConfig
from haulbrokr_collector.importers.aggregate_yards import AggregateYardImporter
from haulbrokr_collector.importers.asphalt_recycling import AsphaltRecyclingImporter
from haulbrokr_collector.importers.base import BaseImporter
from haulbrokr_collector.importers.cd_facilities import CDFacilityImporter
from haulbrokr_collector.importers.concrete_recycling import ConcreteRecyclingImporter
from haulbrokr_collector.importers.dirt_disposal import DirtDisposalImporter
from haulbrokr_collector.importers.epa_landfill import EPALandfillImporter
from haulbrokr_collector.importers.gravel_pits import GravelPitImporter
from haulbrokr_collector.importers.rock_quarries import RockQuarryImporter
from haulbrokr_collector.importers.state_agency import StateAgencyImporter
from haulbrokr_collector.importers.transfer_stations import TransferStationImporter

IMPORTER_CLASSES: list[type[BaseImporter]] = [
    EPALandfillImporter,
    StateAgencyImporter,
    TransferStationImporter,
    CDFacilityImporter,
    DirtDisposalImporter,
    RockQuarryImporter,
    GravelPitImporter,
    AggregateYardImporter,
    AsphaltRecyclingImporter,
    ConcreteRecyclingImporter,
]


def build_importers(config: CollectorConfig) -> list[BaseImporter]:
    """Instantiate enabled importers in registry order."""
    importers: list[BaseImporter] = []
    for cls in IMPORTER_CLASSES:
        instance = cls(config)
        if instance.enabled():
            importers.append(instance)
    return importers


__all__ = [
    "IMPORTER_CLASSES",
    "AggregateYardImporter",
    "AsphaltRecyclingImporter",
    "BaseImporter",
    "CDFacilityImporter",
    "ConcreteRecyclingImporter",
    "DirtDisposalImporter",
    "EPALandfillImporter",
    "GravelPitImporter",
    "RockQuarryImporter",
    "StateAgencyImporter",
    "TransferStationImporter",
    "build_importers",
]
