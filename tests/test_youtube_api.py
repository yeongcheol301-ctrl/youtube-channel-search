import json

import pytest
from googleapiclient.errors import HttpError
from httplib2 import Response

from yt_finder import youtube_api
from yt_finder.youtube_api import YouTubeApiError, YouTubeClient


def _http_error(status: int, reason: str, message: str | None = None) -> HttpError:
    message = message or reason
    body = json.dumps({"error": {"code": status, "errors": [{"reason": reason, "message": message}], "message": message}}).encode()
    return HttpError(Response({"status": status}), body)


class FakeRequest:
    def __init__(self, outcome):
        self.outcome = outcome

    def execute(self):
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    monkeypatch.setattr(youtube_api, "_exhausted", {})


def _client(outcomes_by_key):
    client = YouTubeClient(list(outcomes_by_key))
    client._service = lambda key: key  # 서비스 대신 키 문자열을 넘긴다
    return client, (lambda key: FakeRequest(outcomes_by_key[key]))


def test_rotates_to_next_key_when_quota_exceeded():
    client, make = _client({"k1": _http_error(403, "quotaExceeded"), "k2": {"items": [1]}})
    assert client.execute(make) == {"items": [1]}
    assert youtube_api.is_exhausted("k1")
    assert client.used_keys == ["k2"]


def test_skips_exhausted_key_on_later_calls():
    youtube_api.mark_exhausted("k1")
    calls = []
    client, make = _client({"k1": {"items": ["wrong"]}, "k2": {"items": ["ok"]}})
    assert client.execute(lambda key: calls.append(key) or make(key)) == {"items": ["ok"]}
    assert calls == ["k2"]


def test_skips_invalid_key():
    client, make = _client({"bad": _http_error(400, "keyInvalid"), "good": {"items": []}})
    assert client.execute(make) == {"items": []}


def test_skips_key_reported_as_bad_request():
    # 실제 API는 잘못된 키를 reason=badRequest + "API key not valid" 메시지로 돌려준다.
    bad = _http_error(400, "badRequest", "API key not valid. Please pass a valid API key.")
    client, make = _client({"bad": bad, "good": {"items": []}})
    assert client.execute(make) == {"items": []}


def test_all_keys_exhausted_raises_friendly_message():
    client, make = _client({"k1": _http_error(403, "quotaExceeded"), "k2": _http_error(403, "quotaExceeded")})
    with pytest.raises(YouTubeApiError, match="할당량"):
        client.execute(make)


def test_other_errors_are_not_swallowed():
    client, make = _client({"k1": _http_error(404, "channelNotFound"), "k2": {"items": []}})
    with pytest.raises(YouTubeApiError, match="404"):
        client.execute(make)


def test_personal_key_goes_first(monkeypatch):
    from yt_finder import config

    monkeypatch.setattr(config, "get_shared_api_keys", lambda: ["shared1", "shared2"])
    assert config.get_api_keys(" mine ") == ["mine", "shared1", "shared2"]
    assert config.get_api_keys("") == ["shared1", "shared2"]
