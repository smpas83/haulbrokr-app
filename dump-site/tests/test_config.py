"""Tests for config loading."""

from __future__ import annotations

from pathlib import Path

from haulbrokr_collector.config import load_config


def test_load_default_config() -> None:
    root = Path(__file__).resolve().parents[1]
    config = load_config(root / "config.yaml")
    assert config.app.name.startswith("HaulBrokr")
    assert "CA" in config.states
    assert config.dedupe.name_similarity_threshold == 88.0
    assert config.importers.epa_landfill is True


def test_load_missing_config_uses_defaults(tmp_path: Path) -> None:
    config = load_config(tmp_path / "missing.yaml")
    assert config.app.version == "1.0.0"
    assert config.http.max_retries == 3
