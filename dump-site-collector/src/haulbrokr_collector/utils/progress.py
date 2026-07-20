"""Progress bar helpers wrapping tqdm."""

from __future__ import annotations

from collections.abc import Iterable, Iterator
from typing import TypeVar

from tqdm import tqdm

T = TypeVar("T")


def progress_iter(
    iterable: Iterable[T],
    *,
    desc: str,
    total: int | None = None,
    enabled: bool = True,
    leave: bool = True,
    unit: str = "item",
) -> Iterator[T]:
    """Yield items from *iterable*, optionally wrapped in a tqdm progress bar."""
    if not enabled:
        yield from iterable
        return

    yield from tqdm(
        iterable,
        desc=desc,
        total=total,
        leave=leave,
        unit=unit,
        dynamic_ncols=True,
    )
