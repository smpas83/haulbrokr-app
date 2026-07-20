"""Integration-style tests for the collection pipeline and CLI."""

from __future__ import annotations

from pathlib import Path

import yaml
from click.testing import CliRunner
from haulbrokr_collector.cli import main
from haulbrokr_collector.config import load_config
from haulbrokr_collector.pipeline import CollectorPipeline


def _write_config(tmp_path: Path, states: list[str] | None = None) -> Path:
    root = Path(__file__).resolve().parents[1]
    base = load_config(root / "config.yaml")
    data = base.model_dump()
    data["app"]["output_dir"] = str(tmp_path / "output")
    data["app"]["state_dir"] = str(tmp_path / "state")
    data["app"]["log_dir"] = str(tmp_path / "logs")
    data["app"]["data_dir"] = str(tmp_path / "data")
    data["progress"]["enabled"] = False
    if states is not None:
        data["states"] = states
    tmp_path.mkdir(parents=True, exist_ok=True)
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


def test_pipeline_collect_state(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA", "TX"])
    pipeline = CollectorPipeline.from_config_path(config_path)
    result = pipeline.run(state="CA", export_formats=["csv", "sqlite"])
    assert result["states_processed"] == ["CA"]
    assert result["facility_count"] > 0
    assert Path(result["exports"]["csv"]).exists()
    assert Path(result["exports"]["sqlite"]).exists()


def test_pipeline_resume_skips_completed(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA", "OR"])
    pipeline = CollectorPipeline.from_config_path(config_path)
    first = pipeline.run(state="CA", export_formats=["csv"])
    assert first["states_processed"] == ["CA"]

    # Collect another state without wiping CA
    pipeline_tx = CollectorPipeline.from_config_path(config_path)
    mid = pipeline_tx.run(state="OR", export_formats=["csv"])
    assert mid["states_processed"] == ["OR"]
    assert mid["facility_count"] >= first["facility_count"]

    # Fresh CA+OR then interrupt-style: complete CA only via all-states reset path
    config_path2 = _write_config(tmp_path / "resume", states=["CA", "OR", "WA"])
    p = CollectorPipeline.from_config_path(config_path2)
    p.run(state="CA", export_formats=["csv"])
    p.run(state="OR", export_formats=["csv"])
    resumed = CollectorPipeline.from_config_path(config_path2).run(
        resume=True,
        export_formats=["csv"],
    )
    assert resumed["states_processed"] == ["WA"]
    assert "CA" not in resumed["states_processed"]
    assert "OR" not in resumed["states_processed"]


def test_cli_state_and_stats(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA"])
    runner = CliRunner()
    result = runner.invoke(
        main,
        ["--config", str(config_path), "--state", "CA", "--export", "csv"],
    )
    assert result.exit_code == 0, result.output
    assert "Done." in result.output

    stats = runner.invoke(main, ["--config", str(config_path), "--stats"])
    assert stats.exit_code == 0, stats.output
    assert "Facilities:" in stats.output


def test_cli_export_excel(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA"])
    runner = CliRunner()
    runner.invoke(main, ["--config", str(config_path), "--state", "CA"])
    result = runner.invoke(main, ["--config", str(config_path), "--export", "excel"])
    assert result.exit_code == 0, result.output
    assert "Export complete" in result.output
    assert list((tmp_path / "output").glob("*.xlsx"))
