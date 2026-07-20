"""State environmental agency importers with resumable remote crawl support."""

from __future__ import annotations

from typing import Any, ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter, facility_from_seed
from haulbrokr_collector.importers.seed_data import facilities_for_state
from haulbrokr_collector.logging_setup import get_logger
from haulbrokr_collector.models import Facility, FacilityType, OwnershipType
from haulbrokr_collector.utils.crawler import ResumableCrawler

logger = get_logger("importers.state_agency")

# Known state agency portals (used as source_url metadata).
STATE_AGENCY_URLS: dict[str, str] = {
    "AL": "https://adem.alabama.gov",
    "AK": "https://dec.alaska.gov",
    "AZ": "https://azdeq.gov",
    "AR": "https://www.adeq.state.ar.us",
    "CA": "https://www2.calrecycle.ca.gov/SolidWaste",
    "CO": "https://cdphe.colorado.gov",
    "CT": "https://portal.ct.gov/DEEP",
    "DE": "https://dnrec.delaware.gov",
    "FL": "https://floridadep.gov",
    "GA": "https://epd.georgia.gov",
    "HI": "https://health.hawaii.gov/shwb",
    "ID": "https://www.deq.idaho.gov",
    "IL": "https://epa.illinois.gov",
    "IN": "https://www.in.gov/idem",
    "IA": "https://www.iowadnr.gov",
    "KS": "https://www.kdhe.ks.gov",
    "KY": "https://eec.ky.gov",
    "LA": "https://deq.louisiana.gov",
    "ME": "https://www.maine.gov/dep",
    "MD": "https://mde.maryland.gov",
    "MA": "https://www.mass.gov/orgs/massachusetts-department-of-environmental-protection",
    "MI": "https://www.michigan.gov/egle",
    "MN": "https://www.pca.state.mn.us",
    "MS": "https://www.mdeq.ms.gov",
    "MO": "https://dnr.mo.gov",
    "MT": "https://deq.mt.gov",
    "NE": "https://dee.nebraska.gov",
    "NV": "https://ndep.nv.gov",
    "NH": "https://www.des.nh.gov",
    "NJ": "https://dep.nj.gov",
    "NM": "https://www.env.nm.gov",
    "NY": "https://www.dec.ny.gov",
    "NC": "https://deq.nc.gov",
    "ND": "https://deq.nd.gov",
    "OH": "https://epa.ohio.gov",
    "OK": "https://www.deq.ok.gov",
    "OR": "https://www.oregon.gov/deq",
    "PA": "https://www.dep.pa.gov",
    "RI": "https://dem.ri.gov",
    "SC": "https://scdhec.gov",
    "SD": "https://danr.sd.gov",
    "TN": "https://www.tn.gov/environment",
    "TX": "https://www.tceq.texas.gov",
    "UT": "https://deq.utah.gov",
    "VT": "https://dec.vermont.gov",
    "VA": "https://www.deq.virginia.gov",
    "WA": "https://ecology.wa.gov",
    "WV": "https://dep.wv.gov",
    "WI": "https://dnr.wisconsin.gov",
    "WY": "https://deq.wyoming.gov",
    "DC": "https://doee.dc.gov",
}

_TYPE_MAP: dict[str, FacilityType] = {
    "landfill": FacilityType.LANDFILL,
    "msw landfill": FacilityType.LANDFILL,
    "sanitary landfill": FacilityType.LANDFILL,
    "transfer station": FacilityType.TRANSFER_STATION,
    "transfer_station": FacilityType.TRANSFER_STATION,
    "c&d": FacilityType.CD_FACILITY,
    "cd": FacilityType.CD_FACILITY,
    "cd_facility": FacilityType.CD_FACILITY,
    "construction": FacilityType.CD_FACILITY,
    "recycling": FacilityType.RECYCLING_CENTER,
    "compost": FacilityType.OTHER,
}


def _infer_type(raw: str) -> FacilityType:
    text = raw.strip().lower()
    for key, value in _TYPE_MAP.items():
        if key in text:
            return value
    return FacilityType.LANDFILL


class StateAgencyImporter(SeedBackedImporter):
    """Import facilities registered with state environmental / solid-waste agencies.

    Pulls landfills, transfer stations, and C&D facilities. When
    ``sources.state_agency_url_template`` is set (e.g.
    ``https://example.com/{state}/facilities.csv``), performs a resumable crawl
    per state. Otherwise uses the curated seed catalog enriched with agency URLs.
    """

    name: ClassVar[str] = "state_agency"
    facility_type: ClassVar[FacilityType] = FacilityType.LANDFILL
    default_materials: ClassVar[list[str]] = ["MSW"]
    default_confidence: ClassVar[float] = 0.88
    default_source: ClassVar[str] = "State Environmental Agency"

    def enabled(self) -> bool:
        return self.config.importers.state_agency

    def fetch_for_state(self, state: str) -> list[Facility]:
        code = state.upper()
        agency_url = STATE_AGENCY_URLS.get(code, "")
        template = self.config.sources.state_agency_url_template.strip()
        if template:
            remote_url = template.format(state=code, STATE=code)
            try:
                return self._fetch_remote(code, remote_url, agency_url)
            except Exception as exc:
                logger.warning(
                    "State agency remote fetch failed for %s (%s); seed fallback: %s",
                    code,
                    remote_url,
                    exc,
                )

        facilities: list[Facility] = []
        for ftype in ("landfill", "transfer_station", "cd_facility"):
            for row in facilities_for_state(code, ftype):
                source = str(row.get("source", ""))
                if source in {"EPA LMOP"} and ftype == "landfill":
                    # EPA rows are owned by the EPA importer; skip duplicates here.
                    continue
                enriched = dict(row)
                enriched["source"] = source or self.default_source
                enriched["source_url"] = str(row.get("source_url") or agency_url)
                facilities.append(facility_from_seed(self, enriched))
        return facilities

    def _fetch_remote(
        self,
        state: str,
        url: str,
        agency_url: str,
    ) -> list[Facility]:
        crawler = ResumableCrawler.from_config(self.config)
        lower_url = url.lower()
        if lower_url.endswith(".json") or "format=json" in lower_url:
            payload = crawler.fetch_json(url)
            if isinstance(payload, list):
                rows: list[dict[str, Any]] = [r for r in payload if isinstance(r, dict)]
            elif isinstance(payload, dict):
                data = payload.get("data") or payload.get("results") or []
                rows = [r for r in data if isinstance(r, dict)]
            else:
                rows = []
        else:
            rows = crawler.fetch_csv_rows(url)

        facilities: list[Facility] = []
        for row in rows:
            facility = self._facility_from_remote_row(row, state, url or agency_url)
            if facility is not None:
                facilities.append(facility)

        if not facilities:
            logger.info(
                "State agency remote source empty for %s; using seed fallback",
                state,
            )
            return self._seed_fallback(state, agency_url)
        return facilities

    def _seed_fallback(self, state: str, agency_url: str) -> list[Facility]:
        facilities: list[Facility] = []
        for ftype in ("landfill", "transfer_station", "cd_facility"):
            for row in facilities_for_state(state, ftype):
                source = str(row.get("source", ""))
                if source in {"EPA LMOP"} and ftype == "landfill":
                    continue
                enriched = dict(row)
                enriched["source"] = source or self.default_source
                enriched["source_url"] = str(row.get("source_url") or agency_url)
                facilities.append(facility_from_seed(self, enriched))
        return facilities

    def _facility_from_remote_row(
        self,
        row: dict[str, Any],
        state: str,
        source_url: str,
    ) -> Facility | None:
        lower = {str(k).strip().lower(): v for k, v in row.items()}

        def get(*keys: str) -> str:
            for key in keys:
                value = lower.get(key)
                if value is not None and str(value).strip():
                    return str(value).strip()
            return ""

        row_state = get("state", "state_abbr", "st").upper()
        if row_state and row_state != state:
            return None
        name = get("name", "facility_name", "site_name", "facility")
        if not name:
            return None

        type_raw = get("facility_type", "type", "site_type", "category")
        facility_type = _infer_type(type_raw) if type_raw else FacilityType.LANDFILL

        lat_raw = get("latitude", "lat")
        lon_raw = get("longitude", "lon", "long")
        latitude = float(lat_raw) if lat_raw else None
        longitude = float(lon_raw) if lon_raw else None

        ownership_raw = get("ownership", "owner_type", "public_private").lower()
        if "public" in ownership_raw:
            ownership = OwnershipType.PUBLIC
        elif "private" in ownership_raw:
            ownership = OwnershipType.PRIVATE
        else:
            ownership = OwnershipType.UNKNOWN

        materials_raw = get("accepted_materials", "materials", "waste_types")
        materials = (
            [m.strip() for m in materials_raw.split("|") if m.strip()]
            if materials_raw
            else list(self.default_materials)
        )

        return self._facility(
            name=name,
            state=state,
            address=get("address", "street", "street_address"),
            city=get("city"),
            county=get("county"),
            zip_code=get("zip", "zip_code", "postal_code"),
            latitude=latitude,
            longitude=longitude,
            phone=get("phone", "telephone"),
            operator=get("operator", "operator_name"),
            permit_number=get("permit", "permit_number", "permit_no"),
            accepted_materials=materials,
            facility_type=facility_type,
            ownership=ownership,
            source=self.default_source,
            source_url=source_url,
            confidence_score=0.9,
        )
