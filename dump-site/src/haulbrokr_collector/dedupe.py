"""Fuzzy facility deduplication by name + normalized address."""

from __future__ import annotations

from haulbrokr_collector.config import DedupeConfig
from haulbrokr_collector.logging_setup import get_logger
from haulbrokr_collector.models import Facility
from haulbrokr_collector.utils.normalize import (
    composite_address_key,
    normalize_name,
    normalize_zip,
)
from rapidfuzz import fuzz

logger = get_logger("dedupe")


class FacilityDeduplicator:
    """Merge duplicate facilities using fuzzy name + address matching."""

    def __init__(self, config: DedupeConfig | None = None) -> None:
        self.config = config or DedupeConfig()

    def deduplicate(self, facilities: list[Facility]) -> list[Facility]:
        if not facilities:
            return []

        # Process higher-confidence records first so they become the canonical row.
        ordered = sorted(facilities, key=lambda f: f.confidence_score, reverse=True)
        clusters: list[Facility] = []

        for candidate in ordered:
            match_index = self._find_match(candidate, clusters)
            if match_index is None:
                clusters.append(candidate.model_copy(deep=True))
            else:
                clusters[match_index] = self._merge(clusters[match_index], candidate)

        removed = len(facilities) - len(clusters)
        if removed:
            logger.info("Deduplicated %s facilities → %s unique (%s removed)", len(facilities), len(clusters), removed)
        return clusters

    def _find_match(self, candidate: Facility, clusters: list[Facility]) -> int | None:
        cand_name = normalize_name(candidate.name)
        cand_addr = composite_address_key(
            candidate.address,
            candidate.city,
            candidate.state,
            candidate.zip,
        )
        cand_zip = normalize_zip(candidate.zip)

        for index, existing in enumerate(clusters):
            if self.config.require_same_state and existing.state != candidate.state:
                continue

            if (
                self.config.require_same_zip_when_present
                and cand_zip
                and normalize_zip(existing.zip)
                and cand_zip != normalize_zip(existing.zip)
            ):
                continue

            name_score = fuzz.token_sort_ratio(cand_name, normalize_name(existing.name))
            existing_addr = composite_address_key(
                existing.address,
                existing.city,
                existing.state,
                existing.zip,
            )
            addr_score = fuzz.token_sort_ratio(cand_addr, existing_addr)
            addresses_align = (
                (cand_addr == existing_addr and bool(cand_addr.strip("|")))
                or addr_score >= self.config.address_similarity_threshold
            )

            # Exact / strong address match: allow a looser name threshold so
            # "Altamont Landfill" vs "Altamont Landfill Facility" still merges.
            if addresses_align and name_score >= min(70.0, self.config.name_similarity_threshold):
                return index

            if name_score < self.config.name_similarity_threshold:
                continue

            if addresses_align:
                return index

            # Strong name match + same city/state is enough when addresses are sparse.
            if (
                name_score >= 95
                and candidate.city
                and existing.city
                and normalize_name(candidate.city) == normalize_name(existing.city)
                and (not candidate.address or not existing.address)
            ):
                return index

        return None

    def _merge(self, primary: Facility, secondary: Facility) -> Facility:
        """Prefer non-empty / higher-confidence fields from secondary into primary."""
        data = primary.model_dump()
        secondary_data = secondary.model_dump()

        for key, value in secondary_data.items():
            if key in {"id", "collected_at"}:
                continue
            current = data.get(key)
            if key == "accepted_materials":
                merged = list(dict.fromkeys([*(current or []), *(value or [])]))
                data[key] = merged
                continue
            if key == "confidence_score":
                data[key] = max(float(current or 0), float(value or 0))
                continue
            if key == "source":
                sources = {s for s in (str(current or ""), str(value or "")) if s}
                data[key] = " + ".join(sorted(sources)) if sources else current
                continue
            if _is_empty(current) and not _is_empty(value):
                data[key] = value
            elif (
                not _is_empty(value)
                and secondary.confidence_score > primary.confidence_score
                and key
                not in {
                    "name",
                    "facility_type",
                }
            ):
                data[key] = value

        return Facility.model_validate(data)


def _is_empty(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and not value:
        return True
    return False
