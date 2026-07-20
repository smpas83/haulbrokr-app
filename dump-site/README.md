# HaulBrokr Dump Site Collector

Production-grade Python application that collects, deduplicates, and exports
dump-site and related facility data for HaulBrokr.

Located at `dump-site/` inside the HaulBrokr monorepo.

## Features

- **Typed** Python 3.11+ codebase (Pydantic models)
- **Modular importers** for EPA landfills, state solid-waste agencies, transfer
  stations, C&D, dirt disposal, rock quarries, gravel pits, aggregate yards,
  asphalt recycling, and concrete recycling
- **Resumable HTTP crawling** with Range-resume, on-disk cache, and crawl
  checkpoints for EPA / state remote datasets
- **Fuzzy deduplication** (name + normalized address via RapidFuzz)
- **Resumable** per-state collection runs
- **Exports**: CSV, Excel, SQLite, Supabase-ready CSV (+ optional live Supabase upsert)
- **CLI** with progress bars, logging, and retry logic
- **Unit / integration tests** with pytest

## Requirements

- Python **3.11+** (3.12 recommended)
- pip

## Setup

```bash
cd dump-site
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

For lint/type-check extras:

```bash
pip install -r requirements-dev.txt
```

## Configuration

Edit [`config.yaml`](config.yaml) to toggle importers, adjust dedupe thresholds,
HTTP retries, export defaults, remote source URLs, and the state list.

Optional environment variables for live Supabase export:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | API key |

Remote EPA / state sources (optional — seed data is used when empty):

```yaml
sources:
  epa_landfill_url: "https://example.com/epa-landfills.csv"
  state_agency_url_template: "https://example.com/{state}/facilities.csv"
```

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

After an editable install (`pip install -e .`):

```bash
haulbrokr-collector --state CA
```

## Facility schema

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
dump-site/
├── run.py                      # CLI entry
├── config.yaml                 # Runtime config
├── requirements.txt            # All dependencies
├── src/haulbrokr_collector/
│   ├── models.py               # Facility schema
│   ├── config.py               # Config loader
│   ├── pipeline.py             # Orchestration + resume
│   ├── dedupe.py               # Fuzzy dedupe
│   ├── state.py                # Run-state persistence
│   ├── cli.py                  # Click CLI
│   ├── importers/              # EPA, state agencies, specialty sources
│   ├── exporters/              # CSV / Excel / SQLite / Supabase
│   └── utils/                  # normalize, retry, progress, crawler
├── tests/
├── output/                     # Export artifacts
└── .state/                     # Resume checkpoints + HTTP cache
```

Each state is scraped independently. Progress is written to
`.state/run_state.json` and facilities are stored per state under
`.state/facilities/<STATE>.jsonl`. Remote downloads checkpoint under
`.state/crawl_checkpoints.json` with bodies in `.state/http_cache/`.

## Tests

```bash
cd dump-site
pip install -r requirements.txt
pytest
```

## License

MIT (same as the HaulBrokr monorepo).
