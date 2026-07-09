"""Tests for normalization helpers."""

from __future__ import annotations

from haulbrokr_collector.utils.normalize import (
    composite_address_key,
    normalize_address,
    normalize_name,
    normalize_zip,
)


def test_normalize_name_strips_suffixes() -> None:
    assert normalize_name("Waste Management, Inc.") == "waste management"
    assert normalize_name("Acme Disposal LLC") == "acme disposal"


def test_normalize_address_abbreviations() -> None:
    assert normalize_address("10840 Altamont Pass Road") == "10840 altamont pass rd"
    assert normalize_address("2800 South Workman Mill Street") == "2800 s workman mill st"


def test_normalize_zip() -> None:
    assert normalize_zip("94551-1234") == "94551"
    assert normalize_zip("94551") == "94551"


def test_composite_address_key() -> None:
    key = composite_address_key("10840 Altamont Pass Road", "Livermore", "ca", "94551")
    assert "10840 altamont pass rd" in key
    assert "|CA|" in key
    assert key.endswith("94551")
