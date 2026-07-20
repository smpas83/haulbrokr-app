"""Run-state persistence for resumable per-state collection."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from haulbrokr_collector.logging_setup import get_logger

logger = get_logger("state")

StateStatus = Literal["pending", "in_progress", "completed", "failed", "skipped"]


@dataclass
class StateRunRecord:
    state: str
    status: StateStatus = "pending"
    started_at: str | None = None
    completed_at: str | None = None
    facility_count: int = 0
    error: str | None = None
    importers_run: list[str] = field(default_factory=list)


@dataclass
class RunState:
    """Tracks which states have been processed so runs can resume."""

    run_id: str
    created_at: str
    updated_at: str
    states: dict[str, StateRunRecord] = field(default_factory=dict)
    total_facilities: int = 0
    last_export_formats: list[str] = field(default_factory=list)

    def mark_started(self, state: str) -> None:
        now = _utcnow()
        record = self.states.get(state) or StateRunRecord(state=state)
        record.status = "in_progress"
        record.started_at = now
        record.error = None
        self.states[state] = record
        self.updated_at = now

    def mark_completed(
        self,
        state: str,
        facility_count: int,
        importers_run: list[str],
    ) -> None:
        now = _utcnow()
        record = self.states.get(state) or StateRunRecord(state=state)
        record.status = "completed"
        record.completed_at = now
        record.facility_count = facility_count
        record.importers_run = importers_run
        record.error = None
        self.states[state] = record
        self.total_facilities = sum(r.facility_count for r in self.states.values())
        self.updated_at = now

    def mark_failed(self, state: str, error: str) -> None:
        now = _utcnow()
        record = self.states.get(state) or StateRunRecord(state=state)
        record.status = "failed"
        record.error = error
        record.completed_at = now
        self.states[state] = record
        self.updated_at = now

    def pending_states(self, requested: list[str]) -> list[str]:
        """Return states that still need processing (not completed)."""
        pending: list[str] = []
        for state in requested:
            record = self.states.get(state)
            if record is None or record.status != "completed":
                pending.append(state)
        return pending

    def stats(self) -> dict[str, Any]:
        by_status: dict[str, int] = {}
        for record in self.states.values():
            by_status[record.status] = by_status.get(record.status, 0) + 1
        return {
            "run_id": self.run_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "total_facilities": self.total_facilities,
            "states_tracked": len(self.states),
            "by_status": by_status,
            "last_export_formats": list(self.last_export_formats),
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "total_facilities": self.total_facilities,
            "last_export_formats": self.last_export_formats,
            "states": {code: asdict(record) for code, record in self.states.items()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RunState:
        states: dict[str, StateRunRecord] = {}
        for code, raw in (data.get("states") or {}).items():
            states[code] = StateRunRecord(**raw)
        return cls(
            run_id=data["run_id"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            states=states,
            total_facilities=int(data.get("total_facilities", 0)),
            last_export_formats=list(data.get("last_export_formats") or []),
        )


class StateStore:
    """JSON-backed persistence for run state and per-state facility files."""

    def __init__(self, state_dir: Path, filename: str = "run_state.json") -> None:
        self.state_dir = state_dir
        self.path = state_dir / filename
        self.facilities_dir = state_dir / "facilities"
        # Legacy single-file path (migrated on read if present)
        self.facilities_path = state_dir / "facilities.jsonl"

    def ensure_dirs(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.facilities_dir.mkdir(parents=True, exist_ok=True)

    def load(self) -> RunState | None:
        if not self.path.exists():
            return None
        with self.path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        return RunState.from_dict(data)

    def save(self, run_state: RunState) -> None:
        self.ensure_dirs()
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(run_state.to_dict(), handle, indent=2, sort_keys=True)
        logger.debug("Saved run state to %s", self.path)

    def create_new(self, run_id: str | None = None) -> RunState:
        now = _utcnow()
        return RunState(
            run_id=run_id or f"run-{now.replace(':', '').replace('-', '')}",
            created_at=now,
            updated_at=now,
        )

    def state_facilities_path(self, state: str) -> Path:
        return self.facilities_dir / f"{state.upper()}.jsonl"

    def write_state_facilities(self, state: str, facilities: list[dict[str, Any]]) -> None:
        """Replace persisted facilities for a single state."""
        self.ensure_dirs()
        path = self.state_facilities_path(state)
        with path.open("w", encoding="utf-8") as handle:
            for row in facilities:
                handle.write(json.dumps(row, default=str) + "\n")

    def clear_state_facilities(self, state: str) -> None:
        path = self.state_facilities_path(state)
        if path.exists():
            path.unlink()

    def append_facilities(self, facilities: list[dict[str, Any]]) -> None:
        """Legacy append API — prefer write_state_facilities for new code."""
        self.ensure_dirs()
        with self.facilities_path.open("a", encoding="utf-8") as handle:
            for row in facilities:
                handle.write(json.dumps(row, default=str) + "\n")

    def load_all_facilities(self) -> list[dict[str, Any]]:
        self.ensure_dirs()
        rows: list[dict[str, Any]] = []
        # Prefer per-state files
        per_state = sorted(self.facilities_dir.glob("*.jsonl"))
        if per_state:
            for path in per_state:
                with path.open(encoding="utf-8") as handle:
                    for line in handle:
                        line = line.strip()
                        if line:
                            rows.append(json.loads(line))
            return rows
        # Fall back to legacy combined file
        if self.facilities_path.exists():
            with self.facilities_path.open(encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if line:
                        rows.append(json.loads(line))
        return rows

    def clear_facilities(self) -> None:
        if self.facilities_path.exists():
            self.facilities_path.unlink()
        if self.facilities_dir.exists():
            for path in self.facilities_dir.glob("*.jsonl"):
                path.unlink()

    def reset(self) -> RunState:
        self.ensure_dirs()
        if self.path.exists():
            self.path.unlink()
        self.clear_facilities()
        run_state = self.create_new()
        self.save(run_state)
        return run_state

    def ensure_run(self) -> RunState:
        """Load existing run state or create a new one without wiping facilities."""
        existing = self.load()
        if existing is not None:
            return existing
        run_state = self.create_new()
        self.save(run_state)
        return run_state


def _utcnow() -> str:
    return datetime.now(UTC).isoformat()
