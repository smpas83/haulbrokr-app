"""Retry helpers built on tenacity."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import TypeVar

from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

T = TypeVar("T")

logger = logging.getLogger("haulbrokr_collector.retry")


def _log_before_sleep(retry_state: RetryCallState) -> None:
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    logger.warning(
        "Retrying %s (attempt %s) after error: %s",
        getattr(retry_state.fn, "__name__", "callable"),
        retry_state.attempt_number,
        exc,
    )


def with_retries(
    *,
    max_attempts: int = 3,
    backoff_seconds: float = 1.5,
    max_wait_seconds: float = 30.0,
    retry_on: tuple[type[BaseException], ...] = (Exception,),
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator factory for exponential-backoff retries."""

    return retry(
        reraise=True,
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(
            multiplier=backoff_seconds,
            min=backoff_seconds,
            max=max_wait_seconds,
        ),
        retry=retry_if_exception_type(retry_on),
        before_sleep=_log_before_sleep,
    )
