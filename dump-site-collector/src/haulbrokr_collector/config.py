"""Configuration loading for the dump site collector."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class AppConfig(BaseModel):
    name: str = "HaulBrokr Dump Site Collector"
    version: str = "1.0.0"
    log_level: str = "INFO"
    log_dir: str = "logs"
    output_dir: str = "output"
    state_dir: str = ".state"
    data_dir: str = "data"


class DedupeConfig(BaseModel):
    name_similarity_threshold: float = 88.0
    address_similarity_threshold: float = 90.0
    require_same_state: bool = True
    require_same_zip_when_present: bool = False


class HttpConfig(BaseModel):
    timeout_seconds: float = 30.0
    max_retries: int = 3
    retry_backoff_seconds: float = 1.5
    retry_max_wait_seconds: float = 30.0
    user_agent: str = "HaulBrokrDumpSiteCollector/1.0"


class ProgressConfig(BaseModel):
    enabled: bool = True
    leave: bool = True


class ExportConfig(BaseModel):
    default_formats: list[str] = Field(default_factory=lambda: ["csv", "sqlite"])
    csv_encoding: str = "utf-8"
    excel_sheet_name: str = "facilities"
    sqlite_table: str = "facilities"
    supabase_filename: str = "facilities_supabase.csv"


class ImportersConfig(BaseModel):
    epa_landfill: bool = True
    state_agency: bool = True
    transfer_stations: bool = True
    cd_facilities: bool = True
    dirt_disposal: bool = True
    rock_quarries: bool = True
    gravel_pits: bool = True
    aggregate_yards: bool = True
    asphalt_recycling: bool = True
    concrete_recycling: bool = True


class SourcesConfig(BaseModel):
    epa_landfill_url: str = ""
    state_agency_url_template: str = ""


class CollectorConfig(BaseModel):
    app: AppConfig = Field(default_factory=AppConfig)
    dedupe: DedupeConfig = Field(default_factory=DedupeConfig)
    http: HttpConfig = Field(default_factory=HttpConfig)
    progress: ProgressConfig = Field(default_factory=ProgressConfig)
    export: ExportConfig = Field(default_factory=ExportConfig)
    importers: ImportersConfig = Field(default_factory=ImportersConfig)
    sources: SourcesConfig = Field(default_factory=SourcesConfig)
    states: list[str] = Field(default_factory=list)

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parents[2]

    def resolve_path(self, relative: str) -> Path:
        path = Path(relative)
        if path.is_absolute():
            return path
        return self.project_root / path

    @property
    def output_path(self) -> Path:
        return self.resolve_path(self.app.output_dir)

    @property
    def state_path(self) -> Path:
        return self.resolve_path(self.app.state_dir)

    @property
    def data_path(self) -> Path:
        return self.resolve_path(self.app.data_dir)

    @property
    def log_path(self) -> Path:
        return self.resolve_path(self.app.log_dir)


def _default_config_path() -> Path:
    return Path(__file__).resolve().parents[2] / "config.yaml"


def load_config(path: Path | str | None = None) -> CollectorConfig:
    """Load YAML config, falling back to defaults when the file is missing."""
    config_path = Path(path) if path else _default_config_path()
    raw: dict[str, Any] = {}
    if config_path.exists():
        with config_path.open(encoding="utf-8") as handle:
            loaded = yaml.safe_load(handle) or {}
            if not isinstance(loaded, dict):
                msg = f"Config root must be a mapping: {config_path}"
                raise TypeError(msg)
            raw = loaded
    return CollectorConfig.model_validate(raw)
