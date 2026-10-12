"""The last run, kept on disk so a restart does not forget it.

The page opens on the last run, so a visitor can watch what the demo does
without starting one. Held only in memory it vanished on every redeploy, and
the first visitor after each deploy had nothing to watch but a live run.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from .identity import _home

__all__ = ["default_path", "load", "save"]

log = logging.getLogger(__name__)

FILENAME = "last-run.json"


def default_path() -> Path:
    """``CONCIERGE_LAST_RUN``, else beside the signing key on the same volume."""
    configured = os.environ.get("CONCIERGE_LAST_RUN", "").strip()
    return Path(configured).expanduser() if configured else _home() / FILENAME


def load(path: Path) -> dict[str, Any] | None:
    """The saved run, or ``None``. A bad file is logged and ignored, never fatal:
    a demo that cannot start because its replay is unreadable has lost more than
    the replay."""
    try:
        payload = json.loads(path.read_text())
    except FileNotFoundError:
        return None
    except (OSError, ValueError) as exc:
        log.warning("ignoring unreadable last run at %s: %s", path, exc)
        return None
    if (
        not isinstance(payload, dict)
        or not isinstance(payload.get("entries"), list)
        or not isinstance(payload.get("summary"), dict)
    ):
        log.warning("ignoring last run at %s: not a run", path)
        return None
    return payload


def save(payload: dict[str, Any], path: Path) -> None:
    """Write atomically, so a crash mid-write leaves the previous run intact."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False))
    os.replace(tmp, path)
