"""EPA landfill importer (LMOP / RCRA-oriented) with resumable remote crawl."""

from __future__ import annotations

from typing import Any, ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter, facility_from_seed
from haulbrokr_collector.importers.seed_data import facilities_for_state
from haulbrokr_collector.logging_setup import get_logger
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType
from haulbrokr_collector.utils.crawler import ResumableCrawler

logger = get_logger("importers.epa")

# Common column aliases found in EPA LMOP / solid-waste CSV exports.
_NAME_KEYS = ("name", "landfill_name", "facility_name", "site_name", "lf_name")
_STATE_KEYS = ("state", "state_abbr", "st", "state_code")
_CITY_KEYS = ("city", "city_name", "municipality")
_COUNTY_KEYS = ("county", "county_name")
_ADDRESS_KEYS = ("address", "street_address", "physical_address", "location_address")
_ZIP_KEYS = ("zip", "zip_code", "postal_code", "zipcode")
_LAT_KEYS = ("latitude", "lat", "y")
_LON_KEYS = ("longitude", "lon", "long", "lng", "x")
_PHONE_KEYS = ("phone", "telephone", "phone_number")
_OWNER_KEYS = ("owner", "ownership", "owner_type", "ownership_type")
_OPERATOR_KEYS = ("operator", "operator_name", "owner_operator")
_PERMIT_KEYS = ("permit", "permit_number", "permit_no", "permit_id")


def _pick(row: dict[str, Any], keys: tuple[str, ...]) -> str:
    lower = {str(k).strip().lower(): v for k, v in row.items()}
    for key in keys:
        value = lower.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _pick_float(row: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    raw = _pick(row, keys)
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _ownership_from_row(row: dict[str, Any]) -> OwnershipType:
    raw = _pick(row, _OWNER_KEYS).lower()
    if "public" in raw or "municipal" in raw or "county" in raw or "city" in raw:
        return OwnershipType.PUBLIC
    if "private" in raw or "commercial" in raw:
        return OwnershipType.PRIVATE
    return OwnershipType.UNKNOWN


class EPALandfillImporter(SeedBackedImporter):
    """Import municipal solid waste landfills from EPA-oriented sources.

    When ``sources.epa_landfill_url`` is configured, the importer performs a
    resumable HTTP crawl (CSV or JSON). Offline / CI runs use the curated seed
    catalog filtered to landfills.
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
        url = self.config.sources.epa_landfill_url.strip()
        if url:
            try:
                return self._fetch_remote(state, url)
            except Exception as exc:
                logger.warning(
                    "EPA remote fetch failed (%s); falling back to seed data: %s",
                    url,
                    exc,
                )
        rows = facilities_for_state(state, self.seed_facility_type)
        return [facility_from_seed(self, row) for row in rows]

    def _fetch_remote(self, state: str, url: str) -> list[Facility]:
        crawler = ResumableCrawler.from_config(self.config)
        code = state.upper()
        lower_url = url.lower()

        if lower_url.endswith(".json") or "format=json" in lower_url:
            payload = crawler.fetch_json(url)
            rows = self._rows_from_json(payload)
        else:
            rows = crawler.fetch_csv_rows(url)

        facilities: list[Facility] = []
        for row in rows:
            facility = self._facility_from_remote_row(row, code, url)
            if facility is not None:
                facilities.append(facility)

        if not facilities:
            logger.info(
                "EPA remote source returned no rows for %s; using seed fallback",
                code,
            )
            seed_rows = facilities_for_state(code, self.seed_facility_type)
            return [facility_from_seed(self, row) for row in seed_rows]
        return facilities

    def _rows_from_json(self, payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [r for r in payload if isinstance(r, dict)]
        if isinstance(payload, dict):
            for key in ("data", "features", "results", "records", "landfills"):
                value = payload.get(key)
                if isinstance(value, list):
                    rows: list[dict[str, Any]] = []
                    for item in value:
                        if isinstance(item, dict) and "attributes" in item:
                            rows.append(dict(item["attributes"]))
                        elif isinstance(item, dict) and "properties" in item:
                            props = dict(item["properties"])
                            geom = item.get("geometry") or {}
                            if isinstance(geom, dict):
                                coords = geom.get("coordinates")
                                if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                                    props.setdefault("longitude", coords[0])
                                    props.setdefault("latitude", coords[1])
                            rows.append(props)
                        elif isinstance(item, dict):
                            rows.append(item)
                    return rows
        return []

    def _facility_from_remote_row(
        self,
        row: dict[str, Any],
        state: str,
        source_url: str,
    ) -> Facility | None:
        row_state = _pick(row, _STATE_KEYS).upper()
        if row_state and row_state != state:
            return None
        name = _pick(row, _NAME_KEYS)
        if not name:
            return None
        return self._facility(
            name=name,
            state=state,
            address=_pick(row, _ADDRESS_KEYS),
            city=_pick(row, _CITY_KEYS),
            county=_pick(row, _COUNTY_KEYS),
            zip_code=_pick(row, _ZIP_KEYS),
            latitude=_pick_float(row, _LAT_KEYS),
            longitude=_pick_float(row, _LON_KEYS),
            phone=_pick(row, _PHONE_KEYS),
            operator=_pick(row, _OPERATOR_KEYS),
            permit_number=_pick(row, _PERMIT_KEYS),
            ownership=_ownership_from_row(row),
            source=self.default_source,
            source_url=source_url,
            confidence_score=0.93,
        )
