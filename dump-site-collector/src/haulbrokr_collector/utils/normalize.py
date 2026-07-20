"""Address and name normalization helpers."""

from __future__ import annotations

import re
import unicodedata

_STREET_ABBREVIATIONS: dict[str, str] = {
    "street": "st",
    "avenue": "ave",
    "boulevard": "blvd",
    "drive": "dr",
    "road": "rd",
    "lane": "ln",
    "court": "ct",
    "circle": "cir",
    "highway": "hwy",
    "parkway": "pkwy",
    "place": "pl",
    "terrace": "ter",
    "trail": "trl",
    "way": "way",
    "north": "n",
    "south": "s",
    "east": "e",
    "west": "w",
    "northeast": "ne",
    "northwest": "nw",
    "southeast": "se",
    "southwest": "sw",
}

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE_RE = re.compile(r"\s+")
_ZIP_RE = re.compile(r"^(\d{5})(?:-?\d{4})?$")


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize_whitespace(value: str) -> str:
    return _SPACE_RE.sub(" ", value).strip()


def normalize_name(name: str) -> str:
    """Lowercase, strip punctuation/accents, collapse whitespace."""
    text = strip_accents(name).lower()
    text = _PUNCT_RE.sub(" ", text)
    text = normalize_whitespace(text)
    # Drop common corporate suffixes for fuzzy matching
    for suffix in (" llc", " inc", " corp", " co", " ltd", " lp"):
        if text.endswith(suffix):
            text = text[: -len(suffix)].rstrip()
    return text


def normalize_address(address: str) -> str:
    """Normalize street address for fuzzy comparison."""
    text = strip_accents(address).lower()
    text = _PUNCT_RE.sub(" ", text)
    tokens = normalize_whitespace(text).split(" ")
    expanded: list[str] = []
    for token in tokens:
        expanded.append(_STREET_ABBREVIATIONS.get(token, token))
    return " ".join(expanded)


def normalize_zip(zip_code: str) -> str:
    cleaned = zip_code.strip()
    match = _ZIP_RE.match(cleaned)
    if match:
        return match.group(1)
    digits = re.sub(r"\D", "", cleaned)
    return digits[:5] if len(digits) >= 5 else cleaned


def composite_address_key(
    address: str,
    city: str,
    state: str,
    zip_code: str,
) -> str:
    """Build a normalized address key used during deduplication."""
    parts = [
        normalize_address(address),
        normalize_name(city),
        state.strip().upper(),
        normalize_zip(zip_code),
    ]
    return "|".join(parts)
