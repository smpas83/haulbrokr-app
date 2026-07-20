"""Typed domain models for dump-site facilities."""

from __future__ import annotations

from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class FacilityType(StrEnum):
    LANDFILL = "landfill"
    TRANSFER_STATION = "transfer_station"
    CD_FACILITY = "cd_facility"
    DIRT_DISPOSAL = "dirt_disposal"
    ROCK_QUARRY = "rock_quarry"
    GRAVEL_PIT = "gravel_pit"
    AGGREGATE_YARD = "aggregate_yard"
    ASPHALT_RECYCLING = "asphalt_recycling"
    CONCRETE_RECYCLING = "concrete_recycling"
    RECYCLING_CENTER = "recycling_center"
    OTHER = "other"


class OwnershipType(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"
    UNKNOWN = "unknown"


class Facility(BaseModel):
    """Canonical facility record collected from one or more sources."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    address: str = ""
    city: str = ""
    county: str = ""
    state: str
    zip: str = ""
    latitude: float | None = None
    longitude: float | None = None
    phone: str = ""
    website: str = ""
    email: str = ""
    operator: str = ""
    permit_number: str = ""
    accepted_materials: list[str] = Field(default_factory=list)
    facility_type: FacilityType = FacilityType.OTHER
    ownership: OwnershipType = OwnershipType.UNKNOWN
    source: str = ""
    source_url: str = ""
    last_verified: date | None = None
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)
    collected_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str) -> str:
        cleaned = value.strip().upper()
        if len(cleaned) != 2:
            msg = f"state must be a 2-letter code, got {value!r}"
            raise ValueError(msg)
        return cleaned

    @field_validator("name")
    @classmethod
    def require_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            msg = "name is required"
            raise ValueError(msg)
        return cleaned

    @field_validator("zip")
    @classmethod
    def normalize_zip(cls, value: str) -> str:
        return value.strip()

    @field_validator("accepted_materials", mode="before")
    @classmethod
    def coerce_materials(cls, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        msg = "accepted_materials must be a string or list"
        raise TypeError(msg)

    @field_validator("confidence_score", mode="before")
    @classmethod
    def clamp_confidence(cls, value: Any) -> float:
        score = float(value)
        return max(0.0, min(1.0, score))

    @model_validator(mode="after")
    def validate_coordinates(self) -> Facility:
        if self.latitude is not None and not (-90.0 <= self.latitude <= 90.0):
            msg = f"latitude out of range: {self.latitude}"
            raise ValueError(msg)
        if self.longitude is not None and not (-180.0 <= self.longitude <= 180.0):
            msg = f"longitude out of range: {self.longitude}"
            raise ValueError(msg)
        return self

    @property
    def full_address(self) -> str:
        parts = [self.address, self.city, self.state, self.zip]
        return ", ".join(part for part in parts if part)

    def to_export_row(self) -> dict[str, Any]:
        """Flat dict suitable for CSV / Excel / SQLite export."""
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "city": self.city,
            "county": self.county,
            "state": self.state,
            "zip": self.zip,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "phone": self.phone,
            "website": self.website,
            "email": self.email,
            "operator": self.operator,
            "permit_number": self.permit_number,
            "accepted_materials": "|".join(self.accepted_materials),
            "facility_type": self.facility_type.value,
            "public_private": self.ownership.value,
            "source": self.source,
            "source_url": self.source_url,
            "last_verified": self.last_verified.isoformat() if self.last_verified else "",
            "confidence_score": self.confidence_score,
            "collected_at": self.collected_at.isoformat(),
        }

    def to_supabase_row(self) -> dict[str, Any]:
        """Supabase-oriented column names (snake_case, JSON-friendly materials)."""
        row = self.to_export_row()
        row["accepted_materials"] = self.accepted_materials
        row["is_public"] = self.ownership == OwnershipType.PUBLIC
        row["ownership"] = self.ownership.value
        return row
