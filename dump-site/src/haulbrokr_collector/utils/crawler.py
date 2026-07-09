"""Resumable HTTP crawling helpers for remote facility datasets."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from haulbrokr_collector.config import CollectorConfig, HttpConfig
from haulbrokr_collector.logging_setup import get_logger
from haulbrokr_collector.utils.retry import with_retries

logger = get_logger("crawler")


class CrawlCheckpoint:
    """Persists per-URL crawl progress so interrupted downloads can resume."""

    def __init__(self, state_dir: Path) -> None:
        self.path = state_dir / "crawl_checkpoints.json"
        self.state_dir = state_dir
        self._data: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            with self.path.open(encoding="utf-8") as handle:
                self._data = json.load(handle)
        else:
            self._data = {"urls": {}}

    def save(self) -> None:
        self.state_dir.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as handle:
            json.dump(self._data, handle, indent=2, sort_keys=True)

    def get(self, url: str) -> dict[str, Any]:
        return dict(self._data.setdefault("urls", {}).get(url, {}))

    def mark_complete(self, url: str, *, bytes_read: int, etag: str | None = None) -> None:
        self._data.setdefault("urls", {})[url] = {
            "status": "completed",
            "bytes_read": bytes_read,
            "etag": etag,
        }
        self.save()

    def mark_partial(self, url: str, *, bytes_read: int, cache_path: str) -> None:
        self._data.setdefault("urls", {})[url] = {
            "status": "partial",
            "bytes_read": bytes_read,
            "cache_path": cache_path,
        }
        self.save()

    def clear(self, url: str | None = None) -> None:
        if url is None:
            self._data = {"urls": {}}
        else:
            self._data.setdefault("urls", {}).pop(url, None)
        self.save()


class ResumableCrawler:
    """HTTP client with retries, Range-resume, and on-disk response caching."""

    def __init__(
        self,
        http: HttpConfig,
        state_dir: Path,
        *,
        cache_dir: Path | None = None,
    ) -> None:
        self.http = http
        self.state_dir = state_dir
        self.cache_dir = cache_dir or (state_dir / "http_cache")
        self.checkpoint = CrawlCheckpoint(state_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_config(cls, config: CollectorConfig) -> ResumableCrawler:
        return cls(config.http, config.state_path)

    def _cache_path_for(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
        suffix = Path(urlparse(url).path).suffix or ".bin"
        if len(suffix) > 8:
            suffix = ".bin"
        return self.cache_dir / f"{digest}{suffix}"

    def fetch_text(self, url: str, *, force: bool = False) -> str:
        """Download *url* as text, resuming from a partial cache when possible."""
        return self.fetch_bytes(url, force=force).decode("utf-8", errors="replace")

    def fetch_bytes(self, url: str, *, force: bool = False) -> bytes:
        cache_path = self._cache_path_for(url)
        prior = self.checkpoint.get(url)

        if (
            not force
            and prior.get("status") == "completed"
            and cache_path.exists()
        ):
            logger.info("Using cached response for %s", url)
            return cache_path.read_bytes()

        start_at = 0
        if (
            not force
            and prior.get("status") == "partial"
            and cache_path.exists()
        ):
            start_at = int(prior.get("bytes_read") or cache_path.stat().st_size)

        @with_retries(
            max_attempts=self.http.max_retries,
            backoff_seconds=self.http.retry_backoff_seconds,
            max_wait_seconds=self.http.retry_max_wait_seconds,
            retry_on=(OSError, TimeoutError, ConnectionError, httpx.HTTPError),
        )
        def _download() -> bytes:
            headers = {"User-Agent": self.http.user_agent}
            mode = "wb"
            if start_at > 0:
                headers["Range"] = f"bytes={start_at}-"
                mode = "ab"

            with httpx.Client(
                timeout=self.http.timeout_seconds,
                follow_redirects=True,
                headers={"User-Agent": self.http.user_agent},
            ) as client:
                with client.stream("GET", url, headers=headers) as response:
                    # If server ignores Range, restart from scratch.
                    if start_at > 0 and response.status_code == 200:
                        mode_local = "wb"
                        bytes_read = 0
                    elif start_at > 0 and response.status_code == 206:
                        mode_local = "ab"
                        bytes_read = start_at
                    else:
                        response.raise_for_status()
                        mode_local = mode if start_at == 0 else "wb"
                        bytes_read = 0 if mode_local == "wb" else start_at

                    if response.status_code not in {200, 206}:
                        response.raise_for_status()

                    self.cache_dir.mkdir(parents=True, exist_ok=True)
                    with cache_path.open(mode_local) as handle:
                        for chunk in response.iter_bytes(chunk_size=64 * 1024):
                            handle.write(chunk)
                            bytes_read += len(chunk)
                            if bytes_read % (512 * 1024) < len(chunk):
                                self.checkpoint.mark_partial(
                                    url,
                                    bytes_read=bytes_read,
                                    cache_path=str(cache_path),
                                )

                    etag = response.headers.get("etag")
                    self.checkpoint.mark_complete(
                        url,
                        bytes_read=bytes_read,
                        etag=etag,
                    )
                    return cache_path.read_bytes()

        return _download()

    def fetch_csv_rows(self, url: str, *, force: bool = False) -> list[dict[str, str]]:
        text = self.fetch_text(url, force=force)
        reader = csv.DictReader(io.StringIO(text))
        return [dict(row) for row in reader]

    def fetch_json(self, url: str, *, force: bool = False) -> Any:
        text = self.fetch_text(url, force=force)
        return json.loads(text)
