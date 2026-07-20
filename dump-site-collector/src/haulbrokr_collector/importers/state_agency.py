"""State environmental agency importers."""

from __future__ import annotations

from typing import ClassVar

from haulbrokr_collector.importers.common import SeedBackedImporter, facility_from_seed
from haulbrokr_collector.importers.seed_data import facilities_for_state
from haulbrokr_collector.models import Facility, FacilityType

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


class StateAgencyImporter(SeedBackedImporter):
    """Import facilities registered with state environmental agencies.

    Pulls landfills and transfer stations attributed to state agency sources,
    enriching each record with the state's agency portal URL.
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
            agency_url = template.format(state=code)

        facilities: list[Facility] = []
        for ftype in ("landfill", "transfer_station", "cd_facility"):
            for row in facilities_for_state(code, ftype):
                # Prefer rows already tagged as state-agency sourced; also include
                # CalRecycle / TCEQ / NYSDEC style sources for that state.
                source = str(row.get("source", ""))
                if source in {"EPA LMOP"} and ftype == "landfill":
                    # EPA rows are owned by the EPA importer; skip duplicates here
                    # unless they also carry a state-specific source.
                    continue
                enriched = dict(row)
                enriched["source"] = source or self.default_source
                enriched["source_url"] = str(row.get("source_url") or agency_url)
                facilities.append(facility_from_seed(self, enriched))
        return facilities
