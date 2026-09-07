"""Explicit edition metadata; never invent the release date."""
from datetime import date
import hashlib
import json
from pathlib import Path

MONTHS = ("января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря")

def read_metadata(root, relative):
    root = Path(root).resolve()
    relative = Path(relative)
    target = (root / relative).resolve()
    if relative.is_absolute() or not target.is_relative_to(root):
        raise ValueError("Release metadata must stay inside the repository")
    raw = target.read_bytes()
    value = json.loads(raw.decode("utf-8-sig"))
    if value.get("schemaVersion") != 1 or value.get("edition") != "9.0":
        raise ValueError("Explicit edition 9.0 release metadata is required")
    supplied = value.get("releaseDate")
    if not isinstance(supplied, str) or date.fromisoformat(supplied).isoformat() != supplied:
        raise ValueError("releaseDate must be an explicit YYYY-MM-DD date")
    return value, {"path": relative.as_posix(), "sha256": hashlib.sha256(raw).hexdigest()}

def display_date(value):
    day = date.fromisoformat(value)
    return f"{day.day} {MONTHS[day.month - 1]} {day.year} года"
