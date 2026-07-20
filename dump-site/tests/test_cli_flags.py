"""Additional CLI coverage for required flags."""

from __future__ import annotations

from pathlib import Path

import yaml
from click.testing import CliRunner
from haulbrokr_collector.cli import main
from haulbrokr_collector.config import load_config


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
    path = tmp_path / "config.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


def test_cli_all_states(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA", "OR"])
    runner = CliRunner()
    result = runner.invoke(
        main,
        ["--config", str(config_path), "--all-states", "--export", "csv"],
    )
    assert result.exit_code == 0, result.output
    assert "Done." in result.output
    assert (tmp_path / "output" / "facilities.csv").exists()


def test_cli_resume(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA", "OR", "WA"])
    runner = CliRunner()
    first = runner.invoke(main, ["--config", str(config_path), "--state", "CA"])
    assert first.exit_code == 0, first.output
    second = runner.invoke(main, ["--config", str(config_path), "--state", "OR"])
    assert second.exit_code == 0, second.output
    resumed = runner.invoke(
        main,
        ["--config", str(config_path), "--resume", "--export", "sqlite"],
    )
    assert resumed.exit_code == 0, resumed.output
    assert "WA" in resumed.output or "Done." in resumed.output
    assert list((tmp_path / "output").glob("*.sqlite3"))


def test_cli_export_all(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA"])
    runner = CliRunner()
    runner.invoke(main, ["--config", str(config_path), "--state", "CA"])
    result = runner.invoke(main, ["--config", str(config_path), "--export", "all"])
    assert result.exit_code == 0, result.output
    out = tmp_path / "output"
    assert (out / "facilities.csv").exists()
    assert list(out.glob("*.xlsx"))
    assert list(out.glob("*.sqlite3"))
    assert list(out.glob("*supabase*.csv"))


def test_cli_no_action_exits_nonzero(tmp_path: Path) -> None:
    config_path = _write_config(tmp_path, states=["CA"])
    runner = CliRunner()
    result = runner.invoke(main, ["--config", str(config_path)])
    assert result.exit_code == 2
