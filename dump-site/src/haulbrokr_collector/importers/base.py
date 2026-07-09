"""Base importer interface and shared helpers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import ClassVar

from haulbrokr_collector.config import CollectorConfig
from haulbrokr_collector.logging_setup import get_logger
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType
from haulbrokr_collector.utils.retry import with_retries

logger = get_logger("importers")


class BaseImporter(ABC):
    """Abstract base for all facility importers."""

    name: ClassVar[str] = "base"
    facility_type: ClassVar[FacilityType] = FacilityType.OTHER
    default_materials: ClassVar[list[str]] = []
    default_confidence: ClassVar[float] = 0.7
    default_source: ClassVar[str] = ""
    default_source_url: ClassVar[str] = ""

    def __init__(self, config: CollectorConfig) -> None:
        self.config = config

    @abstractmethod
    def fetch_for_state(self, state: str) -> list[Facility]:
        """Return facilities for a single US state code."""

    def enabled(self) -> bool:
        """Whether this importer is enabled in config."""
        return True

    def _facility(
        self,
        *,
        name: str,
        state: str,
        address: str = "",
        city: str = "",
        county: str = "",
        zip_code: str = "",
        latitude: float | None = None,
        longitude: float | None = None,
        phone: str = "",
        website: str = "",
        email: str = "",
        operator: str = "",
        permit_number: str = "",
        accepted_materials: list[str] | None = None,
        facility_type: FacilityType | None = None,
        ownership: OwnershipType = OwnershipType.UNKNOWN,
        source: str | None = None,
        source_url: str | None = None,
        last_verified: date | None = None,
        confidence_score: float | None = None,
    ) -> Facility:
        return Facility(
            name=name,
            address=address,
            city=city,
            county=county,
            state=state,
            zip=zip_code,
            latitude=latitude,
            longitude=longitude,
            phone=phone,
            website=website,
            email=email,
            operator=operator,
            permit_number=permit_number,
            accepted_materials=accepted_materials or list(self.default_materials),
            facility_type=facility_type or self.facility_type,
            ownership=ownership,
            source=source or self.default_source,
            source_url=source_url or self.default_source_url,
            last_verified=last_verified or date.today(),
            confidence_score=(
                self.default_confidence if confidence_score is None else confidence_score
            ),
        )

    def fetch_with_retry(self, state: str) -> list[Facility]:
        """Fetch with configured retry/backoff."""

        @with_retries(
            max_attempts=self.config.http.max_retries,
            backoff_seconds=self.config.http.retry_backoff_seconds,
            max_wait_seconds=self.config.http.retry_max_wait_seconds,
            retry_on=(OSError, TimeoutError, ConnectionError, RuntimeError),
        )
        def _inner() -> list[Facility]:
            return self.fetch_for_state(state)

        return _inner()
