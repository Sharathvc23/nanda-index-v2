"""Finding counterparties, and saying how each was found."""

from __future__ import annotations

import json

import pytest

from concierge import discovery
from concierge.discovery import CONFIGURED, SEARCHED, Counterparty, org_catalog, search_capability


class _Response:
    def __init__(self, payload):
        self._body = json.dumps(payload).encode()

    def read(self, _n=None):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


#: A routable public address (example.com's), so the address guard passes.
_PUBLIC = "93.184.216.34"


def _serve(monkeypatch, opener):
    """Replaces the network only: DNS answers a public address, and ``opener``
    answers the request. The guard and the URL building still run for real."""
    monkeypatch.setattr(discovery, "_resolve", lambda _host: [_PUBLIC])
    monkeypatch.setattr(discovery, "_open", opener)


@pytest.fixture
def fake_index(monkeypatch):
    """Replaces the network only — the function under test still builds its own URL.

    Deliberately not an autouse fixture: stubbing broadly is how a test in a
    sibling repo ended up stubbing the function it was written to exercise.
    """
    calls: list[str] = []

    def fake(request, timeout=None, **_):
        url = request.full_url if hasattr(request, "full_url") else str(request)
        calls.append(url)
        if "/api/v1/search" in url:
            return _Response(
                {
                    "results": [
                        {
                            "org_id": "orrery-demo",
                            "registry_url": "https://a.test",
                            # The ARD form the index actually returns. The
                            # urn:ai:domain: shape this stub used was retired by
                            # the index's own identifier migration, so a fixture
                            # carrying it describes a response nothing sends.
                            "identifier": "urn:air:a.test:catalog:root",
                            "tags": ["general ai"],
                        },
                        {
                            "org_id": "regentix",
                            "registry_url": "https://a.test",
                            "identifier": "urn:air:regentix.ai:catalog:root",
                            "tags": ["general ai"],
                        },
                        {"org_id": "other", "registry_url": "https://b.test", "tags": []},
                    ]
                }
            )
        return _Response(
            {
                "specVersion": "1.0",
                "entries": [{"identifier": "regentix"}],
                "withheldMembers": 5,
                "omittedMembers": 0,
            }
        )

    _serve(monkeypatch, fake)
    return calls


def test_several_records_for_one_server_are_one_counterparty(fake_index):
    found = search_capability("regentix")
    # The index holds one record per verified domain; three identical addresses
    # are not three counterparties.
    assert [c.url for c in found] == ["https://a.test", "https://b.test"]
    assert all(c.how == SEARCHED for c in found)


def test_a_searched_counterparty_records_the_index_identifier(fake_index):
    assert search_capability("regentix")[0].urn == "urn:air:a.test:catalog:root"


def test_no_match_is_a_finding_not_an_error(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Response({"results": []}))
    assert search_capability("nothing") == []


def test_the_catalog_reports_what_it_is_hiding(fake_index):
    catalog = org_catalog("https://a.test")
    # A catalog with one entry and 5 withheld is a different document from a
    # catalog with one entry, and a caller that cannot tell concludes the
    # organisation has one agent.
    assert catalog["visible"] == 1
    assert catalog["withheld"] == 5


def test_provenance_travels_with_the_address():
    configured = Counterparty(label="regentix-ceo", url="https://ceo.test", how=CONFIGURED)
    assert configured.provenance() == {
        "label": "regentix-ceo",
        "url": "https://ceo.test",
        "how": CONFIGURED,
        "urn": None,
        "tags": [],
    }
    # None, not "" — an empty string would suggest an index answered and said
    # nothing, rather than that none was asked.
    assert configured.urn is None


# ── following a hop to the agent behind it ──────────────────────────────────


def test_a_capability_is_matched_against_published_tags_not_free_text():
    """A substring search over descriptions would match an agent that merely
    mentions a capability."""
    catalog = {
        "entries": [
            {"identifier": "a", "tags": ["Leadership", "Strategy"], "url": "https://a.test/c.json"},
            {"identifier": "b", "tags": ["operations"], "url": "https://b.test/c.json"},
        ]
    }
    assert discovery.find_agent_by_capability(catalog, "leadership")["identifier"] == "a"
    assert discovery.find_agent_by_capability(catalog, " OPERATIONS ")["identifier"] == "b"
    assert discovery.find_agent_by_capability(catalog, "plumbing") is None


def test_an_entry_with_no_url_is_not_a_place_to_send_anything():
    catalog = {"entries": [{"identifier": "a", "tags": ["leadership"]}]}
    assert discovery.find_agent_by_capability(catalog, "leadership") is None


def test_resolving_a_name_that_is_not_registered_is_a_finding_not_an_absence(monkeypatch):
    import urllib.error

    def gone(*_a, **_k):
        raise urllib.error.HTTPError("u", 404, "nope", {}, None)

    _serve(monkeypatch, gone)
    with pytest.raises(discovery.DiscoveryError, match="resolves to nothing"):
        discovery.resolve_pointer("urn:ai:key:uX/agent", index_url="https://ix.test")


def test_a_record_with_no_next_hop_is_refused(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Response({"record": {"seq": 1}}))
    with pytest.raises(discovery.DiscoveryError, match="no next hop"):
        discovery.resolve_pointer("urn:ai:key:uX/agent", index_url="https://ix.test")


def test_a_card_gives_the_address_the_agent_answers_on_not_where_the_card_lives(monkeypatch):
    """A card can be hosted anywhere — this estate serves some from a separate
    host39 server — and the hosting address is not where the agent listens."""
    _serve(
        monkeypatch,
        lambda *_a, **_k: _Response({"name": "CTO", "url": "https://cto.example/"}),
    )
    endpoint, card = discovery.endpoint_from_card("https://cards.elsewhere.test/cto.json")
    assert endpoint == "https://cto.example"
    assert card["name"] == "CTO"


def test_a_card_advertising_http_is_upgraded_rather_than_followed(monkeypatch):
    """A signed request that follows a redirect is one somebody else chose the
    destination for."""
    _serve(
        monkeypatch,
        lambda *_a, **_k: _Response({"name": "x", "url": "http://agent.example"}),
    )
    assert discovery.endpoint_from_card("https://c.test/x.json")[0] == "https://agent.example"


def test_a_card_with_no_url_names_no_address_to_call(monkeypatch):
    _serve(monkeypatch, lambda *_a, **_k: _Response({"name": "stub", "url": None}))
    # Measured on a real published card: name and description set, url null.
    with pytest.raises(discovery.DiscoveryError, match="names no address"):
        discovery.endpoint_from_card("https://c.test/stub.json")


# ── what the concierge will fetch at all ────────────────────────────────────
#
# Every address followed here came from a registrant: a search hit, a catalog
# entry, a card, a pointer. The public demo must not be a way to make this
# server fetch something on its own network.


def _must_not_run(*_a, **_k):
    raise AssertionError("the network must not be touched for a refused address")


@pytest.mark.parametrize(
    "url",
    [
        "http://a.test/card.json",
        "file:///etc/passwd",
        "ftp://a.test/x",
        "https:///no-host",
    ],
)
def test_only_https_is_fetched(monkeypatch, url):
    monkeypatch.setattr(discovery, "_resolve", _must_not_run)
    monkeypatch.setattr(discovery, "_open", _must_not_run)
    with pytest.raises(discovery.UnsafeUrlError):
        discovery.endpoint_from_card(url)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.7",
        "172.16.4.4",
        "192.168.1.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",
        "::1",
        "fd00::1",
        "fe80::1",
        "::ffff:127.0.0.1",
    ],
)
def test_a_host_that_resolves_inside_is_refused(monkeypatch, address):
    monkeypatch.setattr(discovery, "_resolve", lambda _host: [address])
    monkeypatch.setattr(discovery, "_open", _must_not_run)
    with pytest.raises(discovery.UnsafeUrlError, match="non-public"):
        discovery.org_catalog("https://rebind.test")


def test_one_private_answer_among_public_ones_is_enough_to_refuse(monkeypatch):
    monkeypatch.setattr(discovery, "_resolve", lambda _host: [_PUBLIC, "127.0.0.1"])
    monkeypatch.setattr(discovery, "_open", _must_not_run)
    with pytest.raises(discovery.UnsafeUrlError):
        discovery.org_catalog("https://mixed.test")


def test_a_private_ip_literal_is_refused_without_a_lookup(monkeypatch):
    monkeypatch.setattr(discovery, "_resolve", _must_not_run)
    monkeypatch.setattr(discovery, "_open", _must_not_run)
    with pytest.raises(discovery.UnsafeUrlError):
        discovery.endpoint_from_card("https://169.254.169.254/latest/meta-data/")
    with pytest.raises(discovery.UnsafeUrlError):
        discovery.endpoint_from_card("https://[::1]/card.json")


def test_a_host_that_does_not_resolve_is_refused(monkeypatch):
    def nxdomain(_host):
        raise OSError("Name or service not known")

    monkeypatch.setattr(discovery, "_resolve", nxdomain)
    monkeypatch.setattr(discovery, "_open", _must_not_run)
    with pytest.raises(discovery.UnsafeUrlError, match="does not resolve"):
        discovery.org_catalog("https://nope.test")


def test_the_request_is_pinned_to_the_addresses_that_were_checked(monkeypatch):
    """Resolving again at connect time is how DNS rebinding gets past a check."""
    answers = iter([[_PUBLIC], ["127.0.0.1"]])
    monkeypatch.setattr(discovery, "_resolve", lambda _host: next(answers))
    seen: dict = {}

    def opener(request, *, timeout, addresses):
        seen["url"], seen["addresses"] = request.full_url, addresses
        return _Response({"entries": []})

    monkeypatch.setattr(discovery, "_open", opener)
    discovery.org_catalog("https://rebind.test")
    assert seen == {"url": "https://rebind.test/.well-known/ai-catalog.json", "addresses": [_PUBLIC]}


def test_the_pinned_connection_dials_the_checked_address_not_the_name(monkeypatch):
    dialled: list = []
    monkeypatch.setattr(
        discovery.socket, "create_connection", lambda address, *_a, **_k: dialled.append(address) or "sock"
    )
    connect = discovery._dial_pinned([_PUBLIC])
    assert connect(("rebind.test", 443), 5.0, None) == "sock"
    assert dialled == [(_PUBLIC, 443)]


def test_the_pinned_connection_tries_each_checked_address_then_gives_up(monkeypatch):
    dialled: list = []

    def refuse(address, *_a, **_k):
        dialled.append(address[0])
        raise OSError("connection refused")

    monkeypatch.setattr(discovery.socket, "create_connection", refuse)
    with pytest.raises(OSError, match="refused"):
        discovery._dial_pinned([_PUBLIC, "93.184.216.35"])(("x.test", 443), 5.0, None)
    assert dialled == [_PUBLIC, "93.184.216.35"]


def test_the_https_connection_is_built_to_dial_only_the_pinned_addresses():
    handler = discovery._PinnedHTTPSHandler([_PUBLIC])
    conn = handler._connection("a.test", timeout=5.0)
    # SNI and certificate checks still use the name; only the dial is pinned.
    assert conn.host == "a.test"
    assert conn._create_connection.addresses == (_PUBLIC,)


def test_the_opener_uses_no_proxy_and_the_pinned_handler():
    opener = discovery._opener([_PUBLIC])
    kinds = {type(h) for h in opener.handlers}
    assert discovery._PinnedHTTPSHandler in kinds
    assert discovery._SameHostRedirects in kinds
    proxies = [h for h in opener.handlers if isinstance(h, discovery.urllib.request.ProxyHandler)]
    assert all(not h.proxies for h in proxies), "a proxy would dial for us, bypassing the pin"


def _redirect(old: str, new: str):
    import urllib.request

    req = urllib.request.Request(old)
    return discovery._SameHostRedirects().redirect_request(req, None, 302, "Found", {}, new)


def test_a_redirect_to_another_host_is_refused():
    with pytest.raises(discovery.UnsafeUrlError, match="redirect"):
        _redirect("https://a.test/card.json", "https://169.254.169.254/latest/meta-data/")


def test_a_redirect_down_to_http_is_refused():
    with pytest.raises(discovery.UnsafeUrlError, match="redirect"):
        _redirect("https://a.test/card.json", "http://a.test/card.json")


def test_a_redirect_within_the_same_host_is_followed():
    follow = _redirect("https://a.test/card.json", "https://a.test/v2/card.json")
    assert follow.full_url == "https://a.test/v2/card.json"
