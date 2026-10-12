"""How many live runs one visitor may start, per window.

A live run is not free for anyone else: it sends two companies' agents a real
invitation and a note, and holds a real table under the host's grant. On a
public page that has to be bounded per visitor, or one visitor can spend the
host's authority and the guests' patience on their own.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Callable

__all__ = ["RunLimiter", "client_key"]


class RunLimiter:
    """At most ``max_runs`` per visitor in any ``window_seconds``. Zero disables it."""

    def __init__(
        self, max_runs: int, window_seconds: float, clock: Callable[[], float] = time.monotonic
    ) -> None:
        self._max = max_runs
        self._window = window_seconds
        self._clock = clock
        self._runs: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    @property
    def max_runs(self) -> int:
        return self._max

    @property
    def window_seconds(self) -> float:
        return self._window

    def _live(self, key: str, now: float) -> deque[float]:
        runs = self._runs.setdefault(key, deque())
        while runs and now - runs[0] >= self._window:
            runs.popleft()
        return runs

    def would_allow(self, key: str) -> bool:
        """Whether ``try_acquire`` would succeed now, without counting a run.

        Checked before taking the run lock, so a visitor already over the limit
        is turned away without holding the lock, even for an instant, against a
        visitor who is not.
        """
        if self._max <= 0:
            return True
        with self._lock:
            return len(self._live(key, self._clock())) < self._max

    def try_acquire(self, key: str) -> tuple[bool, float]:
        """Count a run for ``key`` if it is allowed; else say how long until it is.

        A refused attempt is not counted, so asking again does not push the wait
        further out.
        """
        if self._max <= 0:
            return True, 0.0
        now = self._clock()
        with self._lock:
            runs = self._live(key, now)
            if len(runs) >= self._max:
                return False, self._window - (now - runs[0])
            runs.append(now)
            return True, 0.0


def client_key(peer: str, forwarded_for: str | None, *, behind_proxy: bool) -> str:
    """Which visitor a request came from.

    ``X-Forwarded-For`` is only evidence when a proxy we run is in front: that
    proxy appends the address it saw, so the last entry is the one to trust and
    everything left of it is whatever the caller sent. Reachable directly, the
    header is the caller's to invent, and trusting it would hand every request a
    fresh allowance.
    """
    if behind_proxy and forwarded_for:
        last = forwarded_for.split(",")[-1].strip()
        if last:
            return last
    return peer
