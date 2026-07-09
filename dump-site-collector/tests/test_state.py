"""Tests for run-state persistence and resume."""

from __future__ import annotations

from pathlib import Path

from haulbrokr_collector.state import StateStore


def test_state_store_roundtrip(tmp_path: Path) -> None:
    store = StateStore(tmp_path)
    run = store.create_new(run_id="test-run")
    run.mark_started("CA")
    run.mark_completed("CA", facility_count=12, importers_run=["epa_landfill"])
    store.save(run)

    loaded = store.load()
    assert loaded is not None
    assert loaded.run_id == "test-run"
    assert loaded.states["CA"].status == "completed"
    assert loaded.states["CA"].facility_count == 12
    assert loaded.pending_states(["CA", "TX"]) == ["TX"]


def test_append_and_load_facilities(tmp_path: Path) -> None:
    store = StateStore(tmp_path)
    store.write_state_facilities(
        "CA",
        [{"name": "A", "state": "CA"}, {"name": "B", "state": "CA"}],
    )
    store.write_state_facilities("TX", [{"name": "C", "state": "TX"}])
    rows = store.load_all_facilities()
    assert len(rows) == 3
    store.clear_state_facilities("CA")
    assert len(store.load_all_facilities()) == 1
    store.clear_facilities()
    assert store.load_all_facilities() == []


def test_reset(tmp_path: Path) -> None:
    store = StateStore(tmp_path)
    run = store.create_new()
    run.mark_completed("OR", 1, ["epa_landfill"])
    store.save(run)
    store.append_facilities([{"name": "X", "state": "OR"}])
    fresh = store.reset()
    assert fresh.states == {}
    assert store.load_all_facilities() == []
