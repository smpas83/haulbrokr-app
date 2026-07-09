"""Tests for remote EPA / state agency importers."""

from __future__ import annotations

from pathlib import Path

import httpx
import respx
import yaml

from haulbrokr_collector.config import CollectorConfig, load_config
from haulbrokr_collector.importers.epa_landfill import EPALandfillImporter
from haulbrokr_collector.importers.state_agency import StateAgencyImporter, STATE_AGENCY_URLS
from haulbrokr_collector.models import FacilityType


def _config_with_paths(tmp_path: Path, **source_overrides: str) -> CollectorConfig:
    root = Path(__file__).resolve().parents[1]
    base = load_config(root / "config.yaml")
    data = base.model_dump()
    data["app"]["output_dir"] = str(tmp_path / "output")
    data["app"]["state_dir"] = str(tmp_path / "state")
    data["app"]["log_dir"] = str(tmp_path / "logs")
    data["app"]["data_dir"] = str(tmp_path / "data")
    data["progress"]["enabled"] = False
    data["sources"].update(source_overrides)
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return load_config(path)


@respx.mock
def test_epa_remote_csv_filters_by_state(tmp_path: Path) -> None:
    url = "https://epa.example/landfills.csv"
    csv_body = (
        "landfill_name,state,city,street_address,zip_code,latitude,longitude\n"
        "Remote Altamont,CA,Livermore,10840 Altamont Pass Rd,94551,37.7,-121.6\n"
        "Remote Other,TX,Austin,1 Main St,78701,30.2,-97.7\n"
    )
    respx.get(url).mock(return_value=httpx.Response(200, text=csv_body))
    config = _config_with_paths(tmp_path, epa_landfill_url=url)
    facilities = EPALandfillImporter(config).fetch_for_state("CA")
    assert len(facilities) == 1
    assert facilities[0].name == "Remote Altamont"
    assert facilities[0].facility_type == FacilityType.LANDFILL
    assert facilities[0].source == "EPA LMOP"


@respx.mock
def test_epa_remote_json_geojson(tmp_path: Path) -> None:
    url = "https://epa.example/landfills.json"
    payload = {
        "features": [
            {
                "properties": {"name": "Geo Landfill", "state": "OR", "city": "Portland"},
                "geometry": {"coordinates": [-122.6, 45.5]},
            }
        ]
    }
    respx.get(url).mock(return_value=httpx.Response(200, json=payload))
    config = _config_with_paths(tmp_path, epa_landfill_url=url)
    facilities = EPALandfillImporter(config).fetch_for_state("OR")
    assert len(facilities) == 1
    assert facilities[0].name == "Geo Landfill"
    assert facilities[0].longitude == -122.6
    assert facilities[0].latitude == 45.5


@respx.mock
def test_state_agency_remote_template(tmp_path: Path) -> None:
    template = "https://agency.example/{state}/facilities.csv"
    url = "https://agency.example/WA/facilities.csv"
    csv_body = (
        "facility_name,state,type,address,city,zip\n"
        "King County Transfer,WA,transfer station,1 Dump Rd,Seattle,98101\n"
        "Cedar Hills Landfill,WA,landfill,2 Dump Rd,Maple Valley,98038\n"
    )
    respx.get(url).mock(return_value=httpx.Response(200, text=csv_body))
    config = _config_with_paths(tmp_path, state_agency_url_template=template)
    facilities = StateAgencyImporter(config).fetch_for_state("WA")
    assert len(facilities) == 2
    types = {f.facility_type for f in facilities}
    assert FacilityType.TRANSFER_STATION in types
    assert FacilityType.LANDFILL in types


def test_state_agency_urls_cover_all_states() -> None:
    assert "CA" in STATE_AGENCY_URLS
    assert "DC" in STATE_AGENCY_URLS
    assert len(STATE_AGENCY_URLS) >= 51


def test_epa_falls_back_to_seed_on_http_error(tmp_path: Path) -> None:
    url = "https://epa.example/missing.csv"
    with respx.mock:
        respx.get(url).mock(return_value=httpx.Response(500))
        config = _config_with_paths(tmp_path, epa_landfill_url=url)
        # max_retries will exhaust; importer should fall back to seed
        config.http.max_retries = 1
        facilities = EPALandfillImporter(config).fetch_for_state("CA")
    assert facilities
    assert any("Altamont" in f.name for f in facilities)
