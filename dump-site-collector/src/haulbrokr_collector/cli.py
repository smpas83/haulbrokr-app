"""Click CLI for HaulBrokr Dump Site Collector."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from haulbrokr_collector import __version__
from haulbrokr_collector.pipeline import CollectorPipeline

console = Console()


def _pipeline(config: Path | None) -> CollectorPipeline:
    return CollectorPipeline.from_config_path(config)


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.option(
    "--state",
    type=str,
    default=None,
    help="Collect facilities for a single US state code (e.g. CA).",
)
@click.option(
    "--all-states",
    is_flag=True,
    default=False,
    help="Collect facilities for every state listed in config.yaml.",
)
@click.option(
    "--resume",
    is_flag=True,
    default=False,
    help="Resume an interrupted run, skipping completed states.",
)
@click.option(
    "--export",
    "export_format",
    type=click.Choice(["csv", "excel", "sqlite", "supabase", "all"], case_sensitive=False),
    default=None,
    help="Export persisted facilities (optionally after a collect run).",
)
@click.option(
    "--stats",
    is_flag=True,
    default=False,
    help="Print collection statistics and exit.",
)
@click.option(
    "--config",
    "config_path",
    type=click.Path(path_type=Path, exists=False),
    default=None,
    help="Path to config.yaml (defaults to project config.yaml).",
)
@click.option(
    "--reset",
    is_flag=True,
    default=False,
    help="Clear run state and persisted facilities before collecting.",
)
@click.version_option(version=__version__, prog_name="HaulBrokr Dump Site Collector")
def main(
    state: str | None,
    all_states: bool,
    resume: bool,
    export_format: str | None,
    stats: bool,
    config_path: Path | None,
    reset: bool,
) -> None:
    """HaulBrokr Dump Site Collector — import, dedupe, and export dump sites."""
    pipeline = _pipeline(config_path)

    if reset:
        pipeline.store.reset()
        console.print("[yellow]Run state reset.[/yellow]")

    if stats and not (state or all_states or resume or export_format):
        _print_stats(pipeline.stats())
        return

    export_formats = _resolve_export_formats(export_format)

    collecting = bool(state or all_states or resume)
    if collecting:
        try:
            result = pipeline.run(
                state=state,
                all_states=all_states,
                resume=resume,
                export_formats=export_formats,
            )
        except ValueError as exc:
            console.print(f"[red]Error:[/red] {exc}")
            sys.exit(2)
        except Exception as exc:
            console.print(f"[red]Collection failed:[/red] {exc}")
            sys.exit(1)

        console.print(
            f"[green]Done.[/green] Processed {len(result['states_processed'])} state(s), "
            f"{result['facility_count']} facilities."
        )
        for fmt, path in result["exports"].items():
            console.print(f"  • {fmt}: {path}")
        if stats:
            _print_stats(pipeline.stats())
        return

    if export_format:
        formats = export_formats or ["csv"]
        paths = pipeline.export_only(formats)
        console.print("[green]Export complete.[/green]")
        for fmt, path in paths.items():
            console.print(f"  • {fmt}: {path}")
        if stats:
            _print_stats(pipeline.stats())
        return

    if stats:
        _print_stats(pipeline.stats())
        return

    console.print(
        "[yellow]No action specified.[/yellow] Use --state, --all-states, "
        "--resume, --export, or --stats. See --help."
    )
    sys.exit(2)


def _resolve_export_formats(export_format: str | None) -> list[str] | None:
    if export_format is None:
        return None
    if export_format.lower() == "all":
        return ["csv", "excel", "sqlite", "supabase"]
    return [export_format.lower()]


def _print_stats(stats: dict) -> None:
    console.print(f"\n[bold]HaulBrokr Dump Site Collector v{__version__}[/bold]")
    console.print(f"Facilities: {stats.get('facility_count', 0)}")
    console.print(f"Avg confidence: {stats.get('average_confidence', 0)}")
    console.print(f"Importers: {', '.join(stats.get('importers_enabled') or [])}")

    run = stats.get("run")
    if run:
        console.print(
            f"Run {run.get('run_id')} — updated {run.get('updated_at')} — "
            f"status {json.dumps(run.get('by_status') or {})}"
        )

    by_type = stats.get("by_type") or {}
    if by_type:
        table = Table(title="By facility type")
        table.add_column("Type")
        table.add_column("Count", justify="right")
        for key, value in by_type.items():
            table.add_row(str(key), str(value))
        console.print(table)

    by_state = stats.get("by_state") or {}
    if by_state:
        table = Table(title="By state")
        table.add_column("State")
        table.add_column("Count", justify="right")
        for key, value in sorted(by_state.items(), key=lambda kv: (-kv[1], kv[0])):
            table.add_row(str(key), str(value))
        console.print(table)


if __name__ == "__main__":
    main()
