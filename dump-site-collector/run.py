#!/usr/bin/env python3
"""Entry point for HaulBrokr Dump Site Collector.

Examples:
    python run.py --state CA
    python run.py --all-states
    python run.py --resume
    python run.py --export excel
    python run.py --stats
"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure src/ is importable when running without an editable install.
_ROOT = Path(__file__).resolve().parent
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from haulbrokr_collector.cli import main

if __name__ == "__main__":
    main()
