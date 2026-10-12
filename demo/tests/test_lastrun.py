"""The last run, kept across restarts.

The page opens on the last run so a visitor can see what the demo does without
starting one. Held only in memory, every redeploy emptied it, and the first
visitor after each deploy had nothing to watch but a live run.
"""

from __future__ import annotations

import json

from concierge import lastrun


def test_a_saved_run_loads_back_unchanged(tmp_path):
    path = tmp_path / "last-run.json"
    payload = {"summary": {"state": "held", "steps": 2}, "entries": [{"seq": 0}, {"seq": 1}]}

    lastrun.save(payload, path)

    assert lastrun.load(path) == payload


def test_nothing_saved_loads_as_none(tmp_path):
    assert lastrun.load(tmp_path / "absent.json") is None


def test_a_corrupt_file_loads_as_none_rather_than_failing_startup(tmp_path):
    path = tmp_path / "last-run.json"
    path.write_text("{not json")

    assert lastrun.load(path) is None


def test_a_file_that_is_not_a_run_loads_as_none(tmp_path):
    path = tmp_path / "last-run.json"
    path.write_text(json.dumps({"summary": None}))

    assert lastrun.load(path) is None


def test_saving_creates_the_directory(tmp_path):
    path = tmp_path / "nested" / "last-run.json"

    lastrun.save({"summary": {}, "entries": []}, path)

    assert path.is_file()


def test_the_default_path_sits_beside_the_signing_key(monkeypatch, tmp_path):
    monkeypatch.delenv("CONCIERGE_LAST_RUN", raising=False)
    monkeypatch.setenv("CONCIERGE_HOME", str(tmp_path))

    assert lastrun.default_path() == tmp_path / "last-run.json"


def test_the_path_can_be_set_explicitly(monkeypatch, tmp_path):
    monkeypatch.setenv("CONCIERGE_LAST_RUN", str(tmp_path / "elsewhere.json"))

    assert lastrun.default_path() == tmp_path / "elsewhere.json"


def test_a_run_without_a_summary_loads_as_none(tmp_path):
    """The replay route reads the summary unconditionally; a file without one
    would fail every page load instead of just having no replay."""
    path = tmp_path / "last-run.json"
    path.write_text(json.dumps({"entries": []}))

    assert lastrun.load(path) is None
