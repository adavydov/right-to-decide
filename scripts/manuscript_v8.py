"""Reuse the reviewed Markdown grammar while separating the new edition's anchors."""
from __future__ import annotations
import manuscript_v7

def parse(raw, identifier, expected_title=None):
    title, blocks, notes, heading = manuscript_v7.parse(raw, identifier, expected_title)
    before, after = "manuscript-v7-" + identifier, "manuscript-v8-" + identifier
    def rename(value):
        if isinstance(value, dict):
            return {key: (item.replace(before, after, 1) if key in {"id", "noteId", "sourceNumberId"}
                          and isinstance(item, str) and item.startswith(before) else rename(item))
                    for key, item in value.items()}
        if isinstance(value, list):
            return [rename(item) for item in value]
        return value
    return title, rename(blocks), rename(notes), heading
