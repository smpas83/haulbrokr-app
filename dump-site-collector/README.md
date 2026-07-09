# HaulBrokr Dump Site Collector

Production-grade Python application that collects, deduplicates, and exports dump-site and related facility data for HaulBrokr.

## Features

- **Typed** Python 3.14 codebase (Pydantic models)
- **Modular importers** for EPA landfills, state agencies, transfer stations, C&D, dirt disposal, rock quarries, gravel pits, aggregate yards, asphalt recycling, and concrete recycling
- **Fuzzy deduplication** (name + normalized address via RapidFuzz)
- **Resumable** per-state runs
- **Exports**: CSV, Excel, SQLite, Supabase-ready CSV
- **CLI** with progress bars, logging, and retry logic
- **Unit tests** with pytest

## Requirements

- Python **3.14+**
- [uv](https://github.com/astral-sh/uv) (recommended) or pip

## Setup

```bash
cd dump-site-collector
uv sync
```

Or with pip:

```bash
pip install -e ".[dev]"
```

## Configuration

Edit [`config.yaml`](config.yaml) to toggle importers, adjust dedupe thresholds, HTTP retries, export defaults, and the state list.

## CLI

```bash
# Collect one state
python run.py --state CA

# Collect every configured state
python run.py --all-states

# Resume an interrupted run (skips completed states)
python run.py --resume

# Export only (from persisted data)
python run.py --export excel
python run.py --export csv
python run.py --export sqlite
python run.py --export supabase
python run.py --export all

# Stats
python run.py --stats

# Combine collect + export + stats
python run.py --state TX --export all --stats
```

You can also use the installed console script after `uv sync`:

```bash
uv run haulbrokr-collector --state CA
```

## Facility schema

Each facility includes:

| Field | Description |
|-------|-------------|
| name, address, city, county, state, zip | Location |
| latitude, longitude | Coordinates |
| phone, website, email | Contact |
| operator, permit number | Operator / permit |
| accepted materials | List of materials |
| facility type | landfill, transfer_station, cd_facility, … |
| public/private | Ownership |
| source, source URL | Provenance |
| last verified | Verification date |
| confidence score | 0.0–1.0 |

## Architecture

```
dump-site-collector/
├── run.py                      # CLI entry
├── config.yaml                 # Runtime config
├── src/haulbrokr_collector/
│   ├── models.py               # Facility schema
│   ├── config.py               # Config loader
│   ├── pipeline.py             # Orchestration + resume
│   ├── dedupe.py               # Fuzzy dedupe
│   ├── state.py                # Run-state persistence
│   ├── cli.py                  # Click CLI
│   ├── importers/              # One module per source type
│   ├── exporters/              # CSV / Excel / SQLite / Supabase
│   └── utils/                  # normalize, retry, progress
├── tests/
├── output/                     # Export artifacts
└── .state/                     # Resume checkpoints
```

Each state is scraped independently. Progress is written to `.state/run_state.json` and facilities are stored per state under `.state/facilities/<STATE>.jsonl`, so `--resume` continues where a previous run left off without redoing completed states.

## Tests

```bash
cd dump-site-collector
uv run pytest
```

## License

MIT (same as the HaulBrokr monorepo).
