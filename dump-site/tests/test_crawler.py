"""Tests for resumable HTTP crawler."""

from __future__ import annotations

from pathlib import Path

import httpx
import respx

from haulbrokr_collector.config import HttpConfig
from haulbrokr_collector.utils.crawler import CrawlCheckpoint, ResumableCrawler


def test_checkpoint_roundtrip(tmp_path: Path) -> None:
    cp = CrawlCheckpoint(tmp_path)
    cp.mark_partial("https://example.com/a.csv", bytes_read=100, cache_path="x")
    cp2 = CrawlCheckpoint(tmp_path)
    assert cp2.get("https://example.com/a.csv")["status"] == "partial"
    cp2.mark_complete("https://example.com/a.csv", bytes_read=200, etag='"abc"')
    assert CrawlCheckpoint(tmp_path).get("https://example.com/a.csv")["status"] == "completed"


@respx.mock
def test_crawler_fetches_and_caches(tmp_path: Path) -> None:
    url = "https://example.com/facilities.csv"
    body = "name,state\nAlpha Landfill,CA\n"
    respx.get(url).mock(return_value=httpx.Response(200, text=body))

    crawler = ResumableCrawler(HttpConfig(max_retries=1), tmp_path)
    text = crawler.fetch_text(url)
    assert "Alpha Landfill" in text
    assert crawler.checkpoint.get(url)["status"] == "completed"

    # Second call should hit cache (no additional network needed even if route removed)
    respx.clear()
    text2 = crawler.fetch_text(url)
    assert text2 == text


@respx.mock
def test_crawler_csv_rows(tmp_path: Path) -> None:
    url = "https://example.com/data.csv"
    respx.get(url).mock(
        return_value=httpx.Response(
            200,
            text="name,state,city\nSite A,CA,Livermore\nSite B,TX,Austin\n",
        )
    )
    crawler = ResumableCrawler(HttpConfig(max_retries=1), tmp_path)
    rows = crawler.fetch_csv_rows(url)
    assert len(rows) == 2
    assert rows[0]["name"] == "Site A"
    assert rows[1]["state"] == "TX"


@respx.mock
def test_crawler_json(tmp_path: Path) -> None:
    url = "https://example.com/data.json"
    respx.get(url).mock(
        return_value=httpx.Response(200, json={"data": [{"name": "X", "state": "OR"}]})
    )
    crawler = ResumableCrawler(HttpConfig(max_retries=1), tmp_path)
    payload = crawler.fetch_json(url)
    assert payload["data"][0]["name"] == "X"
