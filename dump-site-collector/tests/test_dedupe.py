"""Tests for fuzzy facility deduplication."""

from __future__ import annotations

from haulbrokr_collector.dedupe import FacilityDeduplicator
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType


def _fac(**kwargs: object) -> Facility:
    defaults: dict[str, object] = {
        "name": "Altamont Landfill",
        "address": "10840 Altamont Pass Rd",
        "city": "Livermore",
        "state": "CA",
        "zip": "94551",
        "facility_type": FacilityType.LANDFILL,
        "confidence_score": 0.8,
    }
    defaults.update(kwargs)
    return Facility.model_validate(defaults)


def test_dedupe_merges_fuzzy_duplicates() -> None:
    a = _fac(phone="(925) 456-2800", confidence_score=0.95, source="EPA LMOP")
    b = _fac(
        name="Altamont Landfill Facility",
        address="10840 Altamont Pass Road",
        phone="",
        operator="Waste Management",
        confidence_score=0.7,
        source="CalRecycle",
    )
    result = FacilityDeduplicator().deduplicate([a, b])
    assert len(result) == 1
    merged = result[0]
    assert merged.phone == "(925) 456-2800"
    assert merged.operator == "Waste Management"
    assert "EPA LMOP" in merged.source
    assert "CalRecycle" in merged.source


def test_dedupe_keeps_different_sites() -> None:
    a = _fac()
    b = _fac(
        name="Sunshine Canyon Landfill",
        address="14747 Little Tujunga Canyon Rd",
        city="Sylmar",
        zip="91342",
    )
    result = FacilityDeduplicator().deduplicate([a, b])
    assert len(result) == 2


def test_dedupe_merges_materials() -> None:
    a = _fac(accepted_materials=["MSW"], ownership=OwnershipType.PRIVATE)
    b = _fac(
        name="Altamont Landfill",
        accepted_materials=["C&D", "MSW"],
        confidence_score=0.6,
    )
    result = FacilityDeduplicator().deduplicate([a, b])
    assert len(result) == 1
    assert set(result[0].accepted_materials) == {"MSW", "C&D"}


def test_dedupe_respects_state_boundary() -> None:
    a = _fac(state="CA")
    b = _fac(state="NV", city="Livermore")  # same name/address text, different state
    result = FacilityDeduplicator().deduplicate([a, b])
    assert len(result) == 2
