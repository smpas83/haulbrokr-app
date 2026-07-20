"""Collection pipeline: per-state import, dedupe, persist, export."""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

from haulbrokr_collector.config import CollectorConfig, load_config
from haulbrokr_collector.dedupe import FacilityDeduplicator
from haulbrokr_collector.exporters import FacilityExporter, facilities_from_export_rows
from haulbrokr_collector.importers import build_importers
from haulbrokr_collector.logging_setup import get_logger, setup_logging
from haulbrokr_collector.models import Facility
from haulbrokr_collector.state import RunState, StateStore
from haulbrokr_collector.utils.progress import progress_iter

logger = get_logger("pipeline")


class CollectorPipeline:
    """Orchestrates state-by-state collection with resume support."""

    def __init__(self, config: CollectorConfig) -> None:
        self.config = config
        self.store = StateStore(config.state_path)
        self.deduper = FacilityDeduplicator(config.dedupe)
        self.exporter = FacilityExporter.from_config(config)
        self.importers = build_importers(config)

    @classmethod
    def from_config_path(cls, path: Path | str | None = None) -> CollectorPipeline:
        config = load_config(path)
        setup_logging(config.app.log_level, config.log_path)
        config.output_path.mkdir(parents=True, exist_ok=True)
        config.state_path.mkdir(parents=True, exist_ok=True)
        config.log_path.mkdir(parents=True, exist_ok=True)
        return cls(config)

    def resolve_states(
        self,
        *,
        state: str | None = None,
        all_states: bool = False,
        resume: bool = False,
    ) -> tuple[list[str], RunState]:
        configured = [s.upper() for s in self.config.states]
        if not configured:
            msg = "No states configured in config.yaml"
            raise ValueError(msg)

        run_state = self.store.load()
        if resume:
            if run_state is None:
                logger.warning("No prior run state found; starting a fresh run")
                run_state = self.store.create_new()
                self.store.save(run_state)
            if state:
                requested = [state.upper()]
            else:
                # --resume alone (or with --all-states) continues the full configured set
                requested = configured
            pending = run_state.pending_states(requested)
            return pending, run_state

        # Fresh run
        if state:
            requested = [state.upper()]
            # Re-collect a single state without wiping other states' progress.
            run_state = self.store.ensure_run()
            for code in requested:
                self.store.clear_state_facilities(code)
                if code in run_state.states:
                    del run_state.states[code]
            self.store.save(run_state)
            return requested, run_state

        if all_states:
            requested = configured
            run_state = self.store.reset()
            return requested, run_state

        msg = "Specify --state CODE, --all-states, or --resume"
        raise ValueError(msg)

    def collect_state(self, state: str) -> tuple[list[Facility], list[str]]:
        """Run all enabled importers for a single state and dedupe."""
        return self._collect_state_pair(state)

    def run(
        self,
        *,
        state: str | None = None,
        all_states: bool = False,
        resume: bool = False,
        export_formats: list[str] | None = None,
    ) -> dict[str, Any]:
        states, run_state = self.resolve_states(
            state=state,
            all_states=all_states,
            resume=resume,
        )

        if not states:
            logger.info("Nothing to do — all requested states already completed")
            facilities = self.load_persisted_facilities()
            paths = self._maybe_export(facilities, export_formats, run_state)
            return {
                "states_processed": [],
                "facility_count": len(facilities),
                "exports": {k: str(v) for k, v in paths.items()},
                "stats": run_state.stats(),
            }

        logger.info("Collecting %s state(s): %s", len(states), ", ".join(states))
        processed: list[str] = []

        for code in progress_iter(
            states,
            desc="States",
            total=len(states),
            enabled=self.config.progress.enabled,
            leave=True,
            unit="state",
        ):
            run_state.mark_started(code)
            self.store.save(run_state)
            try:
                facilities, importers_run = self._collect_state_pair(code)
                self.store.write_state_facilities(
                    code,
                    [f.to_export_row() for f in facilities],
                )
                run_state.mark_completed(code, len(facilities), importers_run)
                self.store.save(run_state)
                processed.append(code)
                logger.info("Completed %s (%s facilities)", code, len(facilities))
            except Exception as exc:
                run_state.mark_failed(code, str(exc))
                self.store.save(run_state)
                logger.error("Failed %s: %s", code, exc)
                raise

        all_facilities = self.load_persisted_facilities()
        # Global dedupe across states (handles border / multi-source overlap)
        all_facilities = self.deduper.deduplicate(all_facilities)
        paths = self._maybe_export(all_facilities, export_formats, run_state)

        return {
            "states_processed": processed,
            "facility_count": len(all_facilities),
            "exports": {k: str(v) for k, v in paths.items()},
            "stats": run_state.stats(),
        }

    def _collect_state_pair(self, state: str) -> tuple[list[Facility], list[str]]:
        code = state.upper()
        collected: list[Facility] = []
        ran: list[str] = []
        for importer in self.importers:
            facilities = importer.fetch_with_retry(code)
            logger.info("%s/%s → %s facilities", code, importer.name, len(facilities))
            collected.extend(facilities)
            ran.append(importer.name)
        return self.deduper.deduplicate(collected), ran

    def _maybe_export(
        self,
        facilities: list[Facility],
        export_formats: list[str] | None,
        run_state: RunState,
    ) -> dict[str, Path]:
        formats = export_formats or list(self.config.export.default_formats)
        paths = self.exporter.export(facilities, formats=formats)
        run_state.last_export_formats = list(paths.keys())
        self.store.save(run_state)
        return paths

    def load_persisted_facilities(self) -> list[Facility]:
        rows = self.store.load_all_facilities()
        return facilities_from_export_rows(rows)

    def export_only(self, formats: list[str]) -> dict[str, Path]:
        facilities = self.deduper.deduplicate(self.load_persisted_facilities())
        if not facilities:
            logger.warning("No persisted facilities to export")
        paths = self.exporter.export(facilities, formats=formats)
        run_state = self.store.load() or self.store.create_new()
        run_state.last_export_formats = list(paths.keys())
        self.store.save(run_state)
        return paths

    def stats(self) -> dict[str, Any]:
        run_state = self.store.load()
        facilities = self.load_persisted_facilities()
        by_type = Counter(f.facility_type.value for f in facilities)
        by_state = Counter(f.state for f in facilities)
        by_ownership = Counter(f.ownership.value for f in facilities)
        avg_confidence = (
            sum(f.confidence_score for f in facilities) / len(facilities) if facilities else 0.0
        )
        return {
            "run": run_state.stats() if run_state else None,
            "facility_count": len(facilities),
            "by_type": dict(sorted(by_type.items())),
            "by_state": dict(sorted(by_state.items())),
            "by_ownership": dict(sorted(by_ownership.items())),
            "average_confidence": round(avg_confidence, 4),
            "importers_enabled": [i.name for i in self.importers],
        }
