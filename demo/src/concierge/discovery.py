"""Find counterparties through the NANDA index, and record how each was found."""

from __future__ import annotations

import http.client
import ipaddress
import json
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "CONFIGURED",
    "PUBLIC_INDEX",
    "RESOLVED",
    "SEARCHED",
    "Counterparty",
    "UnsafeUrlError",
    "entry_claims",
    "fetch_json",
    "org_catalog",
    "search_capability",
]

PUBLIC_INDEX = "https://api.nandaindex.org"

#: How a counterparty's address came to be known. These are not decorations: a
#: claim is only as strong as its weakest hop, and a reader cannot tell them
#: apart from the transcript of a successful run.
SEARCHED = "searched"  # a capability query returned it
RESOLVED = "resolved"  # an index pointer bound its name to its key
CONFIGURED = "configured"  # an operator supplied it; nothing vouched for it


@dataclass(frozen=True)
class Counterparty:
    """Somewhere to send a request, and the provenance of that address."""

    label: str
    url: str
    how: str
    #: Present only when an index record was actually read. ``None`` means no
    #: index vouched for this address — distinct from an empty string, which
    #: would suggest one did and said nothing.
    urn: str | None = None
    tags: tuple[str, ...] = field(default_factory=tuple)

    def provenance(self) -> dict[str, Any]:
        """What a receipt records about how this address was obtained."""
        return {"label": self.label, "url": self.url, "how": self.how, "urn": self.urn, "tags": list(self.tags)}


# ── fetching what a registrant pointed at ───────────────────────────────────
#
# Every address followed here came from somebody else: a search hit, a catalog
# entry, a card, a pointer. The demo is public, so without a guard anyone could
# register a record pointing inside the host's network and have this agent fetch
# it. Same rule as the index server's outbound guard: https only, to a host whose
# every address is publicly routable, connected to exactly the addresses checked
# (a second lookup at connect time is how DNS rebinding slips past a check), and
# never redirected to a different host.


class UnsafeUrlError(RuntimeError):
    """An address this agent refuses to fetch. Refused before any connection."""


def _resolve(host: str) -> list[str]:
    """Every address ``host`` resolves to. Replaced in tests."""
    return sorted({str(info[4][0]) for info in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)})


def _is_public(address: str) -> bool:
    ip = ipaddress.ip_address(address.split("%", 1)[0])
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        # ::ffff:a.b.c.d is never a legitimate public target here.
        return False
    return ip.is_global and not ip.is_multicast


def _checked_addresses(url: str) -> list[str]:
    """The public addresses ``url`` may be fetched from, or a refusal."""
    parts = urllib.parse.urlsplit(url)
    host = parts.hostname
    if parts.scheme != "https" or not host:
        raise UnsafeUrlError(f"refusing to fetch {url!r}: only https URLs with a host are followed")
    try:
        addresses = [str(ipaddress.ip_address(host))]
    except ValueError:
        try:
            addresses = _resolve(host)
        except OSError as exc:
            raise UnsafeUrlError(f"refusing to fetch {url!r}: {host} does not resolve") from exc
    if not addresses or not all(_is_public(a) for a in addresses):
        raise UnsafeUrlError(f"refusing to fetch {url!r}: {host} resolves to a non-public address")
    return addresses


class _dial_pinned:  # noqa: N801 - stands in for socket.create_connection, named like it
    """``socket.create_connection`` that dials only the checked addresses, in order."""

    def __init__(self, addresses: list[str]) -> None:
        self.addresses = tuple(addresses)

    def __call__(self, address: tuple[str, int], timeout: Any = None, source_address: Any = None) -> Any:
        failure: OSError | None = None
        for pinned in self.addresses:
            try:
                return socket.create_connection((pinned, address[1]), timeout, source_address)
            except OSError as exc:
                failure = exc
        raise failure or OSError("no address to dial")


class _PinnedHTTPSHandler(urllib.request.HTTPSHandler):
    """HTTPS whose connections dial the checked addresses. SNI and certificate
    verification still use the hostname, so a pinned address must still prove
    it is that host."""

    def __init__(self, addresses: list[str]) -> None:
        super().__init__(context=ssl.create_default_context())
        self._addresses = addresses

    def _connection(self, host: str, **kwargs: Any) -> http.client.HTTPSConnection:
        kwargs.setdefault("context", self._context)  # type: ignore[attr-defined]
        conn = http.client.HTTPSConnection(host, **kwargs)
        conn._create_connection = _dial_pinned(self._addresses)  # type: ignore[attr-defined]
        return conn

    def https_open(self, req: urllib.request.Request) -> Any:
        return self.do_open(self._connection, req)  # type: ignore[arg-type]


class _SameHostRedirects(urllib.request.HTTPRedirectHandler):
    """Follows a redirect only to the same https host and port. Anywhere else
    is a destination the redirecting server chose, not one that was checked."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        old, new = urllib.parse.urlsplit(req.full_url), urllib.parse.urlsplit(newurl)
        if new.scheme != "https" or (new.hostname, new.port) != (old.hostname, old.port):
            raise UnsafeUrlError(f"refusing redirect from {req.full_url!r} to {newurl!r}: a different host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _opener(addresses: list[str]) -> urllib.request.OpenerDirector:
    # No proxy: a proxy dials on our behalf and the pin would not apply.
    return urllib.request.build_opener(
        urllib.request.ProxyHandler({}), _PinnedHTTPSHandler(addresses), _SameHostRedirects()
    )


def _open(request: urllib.request.Request, *, timeout: float, addresses: list[str]) -> Any:
    """Send ``request`` to one of ``addresses``. Replaced in tests."""
    return _opener(addresses).open(request, timeout=timeout)


def fetch_json(url: str, *, timeout: float) -> Any:
    """GET a registrant-supplied URL as JSON, through the guard above."""
    addresses = _checked_addresses(url)
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    with _open(request, timeout=timeout, addresses=addresses) as response:
        return json.loads(response.read(500_000).decode())


def search_capability(term: str, *, index_url: str = PUBLIC_INDEX, timeout: float = 20.0) -> list[Counterparty]:
    """Organisations the public index says match ``term``."""
    query = urllib.parse.urlencode({"q": term})
    payload = fetch_json(f"{index_url.rstrip('/')}/api/v1/search?{query}", timeout=timeout)

    found: list[Counterparty] = []
    seen: set[str] = set()
    for record in payload.get("results") or []:
        url = (record.get("registry_url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        found.append(
            Counterparty(
                label=record.get("org_id") or record.get("display_name") or url,
                url=url,
                how=SEARCHED,
                urn=record.get("identifier"),
                tags=tuple(record.get("tags") or ()),
            )
        )
    return found


def org_catalog(registry_url: str, *, timeout: float = 20.0) -> dict[str, Any]:
    """The org's catalog document, and what it admits it is not showing."""
    url = f"{registry_url.rstrip('/')}/.well-known/ai-catalog.json"
    payload = fetch_json(url, timeout=timeout)
    entries = payload.get("entries") or []
    return {
        "url": url,
        "entries": entries,
        "visible": len(entries),
        "withheld": payload.get("withheldMembers", 0),
        "omitted": payload.get("omittedMembers", 0),
    }


# ── following a hop to the agent behind it ──────────────────────────────────


class DiscoveryError(RuntimeError):
    """A hop answered, and what it answered cannot be followed."""


def find_agent_by_capability(catalog: dict[str, Any], capability: str) -> dict[str, Any] | None:
    """The first catalog entry whose published tags claim ``capability``."""
    for entry in catalog.get("entries") or []:
        if entry_claims(entry, capability) and entry.get("url"):
            return entry
    return None


def entry_claims(entry: dict[str, Any], capability: str) -> bool:
    """Whether a catalog entry publishes ``capability`` among its tags."""
    wanted = capability.strip().lower()
    if not wanted:
        return False
    return wanted in [str(t).strip().lower() for t in (entry.get("tags") or [])]


def resolve_pointer(urn: str, *, index_url: str, timeout: float = 20.0) -> dict[str, Any]:
    """The second index's record for ``urn``: where this key says it can be reached."""
    query = urllib.parse.urlencode({"id": urn})
    try:
        payload = fetch_json(f"{index_url.rstrip('/')}/v1/resolve?{query}", timeout=timeout)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise DiscoveryError(f"{urn} resolves to nothing — never registered, or lapsed") from exc
        raise
    record = payload.get("record")
    if not isinstance(record, dict) or not record.get("next_hop"):
        raise DiscoveryError(f"{urn} resolved to a record with no next hop: {str(payload)[:200]}")
    return record


def endpoint_from_card(card_url: str, *, timeout: float = 20.0) -> tuple[str, dict[str, Any]]:
    """Follow a card URL to the address the agent actually answers on."""
    card = fetch_json(card_url, timeout=timeout)
    endpoint = (card.get("url") or "").strip()
    if not endpoint:
        raise DiscoveryError(f"{card_url} is a card with no url — it names no address to call")
    # Cards in this estate are published with http:// even where the service is
    # https-only. Upgraded rather than trusted: the counterparty redirects, and a
    # signed request that follows a redirect is a signed request somebody else
    # chose the destination for.
    if endpoint.startswith("http://"):
        endpoint = "https://" + endpoint[len("http://") :]
    return endpoint.rstrip("/"), card
