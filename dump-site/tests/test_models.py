"""Unit tests for Facility model."""

from __future__ import annotations

from datetime import date

import pytest
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType
from pydantic import ValidationError


def test_facility_requires_name_and_state() -> None:
    facility = Facility(name="Test Landfill", state="ca")
    assert facility.state == "CA"
    assert facility.name == "Test Landfill"
    assert facility.facility_type == FacilityType.OTHER


def test_facility_rejects_bad_state() -> None:
    with pytest.raises(ValidationError):
        Facility(name="X", state="California")


def test_facility_materials_from_string() -> None:
    facility = Facility(
        name="Yard",
        state="TX",
        accepted_materials="concrete, asphalt, wood",
    )
    assert facility.accepted_materials == ["concrete", "asphalt", "wood"]


def test_facility_export_row() -> None:
    facility = Facility(
        name="Altamont Landfill",
        address="10840 Altamont Pass Rd",
        city="Livermore",
        county="Alameda",
        state="CA",
        zip="94551",
        phone="(925) 456-2800",
        operator="Waste Management",
        permit_number="CA-01-AA-0009",
        accepted_materials=["MSW", "C&D"],
        facility_type=FacilityType.LANDFILL,
        ownership=OwnershipType.PRIVATE,
        source="EPA LMOP",
        source_url="https://www.epa.gov/lmop",
        last_verified=date(2026, 7, 1),
        confidence_score=0.94,
    )
    row = facility.to_export_row()
    assert row["name"] == "Altamont Landfill"
    assert row["public_private"] == "private"
    assert row["accepted_materials"] == "MSW|C&D"
    assert row["facility_type"] == "landfill"
    assert row["last_verified"] == "2026-07-01"

    supabase = facility.to_supabase_row()
    assert supabase["accepted_materials"] == ["MSW", "C&D"]
    assert supabase["is_public"] is False
    assert supabase["ownership"] == "private"


def test_confidence_clamped() -> None:
    facility = Facility(name="A", state="OR", confidence_score=1.5)
    assert facility.confidence_score == 1.0


def test_coordinate_validation() -> None:
    with pytest.raises(ValidationError):
        Facility(name="A", state="OR", latitude=100.0)
