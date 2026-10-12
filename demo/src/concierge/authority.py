"""Load and check the delegated authority grant this agent acts under."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

__all__ = [
    "CATEGORIES",
    "COUNTERPARTIES",
    "AuthorityError",
    "authority_dir",
    "check_grant_covers",
    "grant",
    "grant_receipt",
    "grant_receipt_id",
    "host_did",
    "mint_command",
    "summary",
]

#: The grant committed here belongs to the reference deployment, whose key is in
#: that grant and nowhere else. A copy of this demo is a DIFFERENT agent — its
#: key is its own, so its name is its own, and this grant does not name it.
_BUNDLED = Path(__file__).resolve().parent / "authority"


def authority_dir() -> Path:
    """Where this deployment's grant lives.

    Defaults to the committed artifacts, which is what the reference deployment
    runs on. ``CONCIERGE_AUTHORITY`` points somewhere else, so anyone running
    their own copy mints a grant into their own directory instead of editing a
    tracked file that belongs to another agent. Mirrors ``CONCIERGE_HOME`` for
    the signing key: identity and the authority over it are both
    per-deployment, not properties of the source tree.
    """
    configured = os.environ.get("CONCIERGE_AUTHORITY", "").strip()
    return Path(configured).expanduser() if configured else _BUNDLED


def mint_command(agent_did: str = "did:key:z6Mk…") -> str:
    """The command that fixes every refusal here.

    Built rather than written into each message: a refusal that names the
    problem and not the remedy is where someone running this demo stops.
    """
    return f"AGENT_DID='{agent_did}' python3 tools/mint_grant.py"


#: What the host permits. Exactly the categories the scenario emits — a grant
#: wider than the work it authorises is an authority nobody audited.
CATEGORIES = [
    "appointment_booked",
    "commitment_entered",
    "message_sent",
    "record_filed",
    "attestation_received",
    "other",
]

#: Who the agent may deal with, as stable labels rather than DIDs, so the
#: allowlist is checkable by someone holding only the grant. sm-dat fails this
#: closed: an action naming no counterparty is VIOLATED, so every receipt must
#: say where it went. Imported by both the minting tool and the scenario.
COUNTERPARTIES = [
    "index:public",
    "index:second",
    "org:regentix",
    "org:astrocity",
    "org:rocketbrain",
    "agent:regentix-ceo",
    "agent:astrocity-chief-scientist",
    "venue:nanda-demo",
]


class AuthorityError(RuntimeError):
    """This agent holds no grant covering what it was asked to do."""


def _load(name: str) -> dict[str, Any]:
    path = authority_dir() / name
    if not path.is_file():
        raise AuthorityError(
            f"{path} is missing. This agent runs under a delegated grant it cannot "
            f"mint for itself. An operator mints one for this agent's key:\n\n    {mint_command()}\n"
        )
    return json.loads(path.read_text())


@lru_cache(maxsize=1)
def grant() -> dict[str, Any]:
    """The signed Delegated Authority Token."""
    return _load("grant.json")


@lru_cache(maxsize=1)
def grant_receipt() -> dict[str, Any]:
    """The host's ``authority_granted`` ARP receipt, committing to the DAT."""
    return _load("grant-receipt.json")


def host_did() -> str:
    """The principal. Read from the signed grant, never from a seed this process
    holds — a host key inside the agent is not a host."""
    return str(grant_receipt()["principal_did"])


def grant_receipt_id() -> str:
    """What every working receipt points at as its authority."""
    return str(grant_receipt()["receipt_id"])


def check_grant_covers(agent_did: str) -> None:
    """Refuse to start a run this agent is not authorised to make."""
    dat = grant()
    granted_to = dat.get("grantee_did")
    if granted_to != agent_did:
        raise AuthorityError(
            f"the grant in {authority_dir()} authorises {granted_to}, but this agent is "
            f"{agent_did}.\n\n"
            "This is a different agent, not a misconfigured one: the name is derived from "
            "the key, so a copy of this demo with its own key is its own agent and needs "
            "its own grant. An operator mints one for this key:\n\n"
            f"    {mint_command(agent_did)}\n\n"
            "Running on somebody else's grant is the one thing this check exists to stop, "
            "so there is deliberately no flag that skips it."
        )
    payload = grant_receipt()["action"].get("machine_payload") or {}
    if payload.get("granted_to_did") != agent_did:
        raise AuthorityError(
            "the host's authority_granted receipt names a different grantee than the "
            "grant it commits to; one of the two artifacts is stale."
        )


def summary() -> dict[str, Any]:
    """What the page shows about the authority behind a run."""
    dat = grant()
    scope = dat.get("scope") or {}
    return {
        "grant_id": dat.get("grant_id"),
        "host": host_did(),
        "agent": dat.get("grantee_did"),
        "human_summary": dat.get("human_summary"),
        "categories": list(scope.get("action_categories") or []),
        "counterparties": list((scope.get("stateless") or {}).get("counterparty_allowlist") or []),
        "not_before": dat.get("not_before"),
        "not_after": dat.get("not_after"),
        "receipt_id": grant_receipt_id(),
        # Said out loud rather than left to be noticed: this grant names no
        # revocation source, so nothing here can be withdrawn before it expires.
        "revocable": bool(dat.get("revocation")),
    }
