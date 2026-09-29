from __future__ import annotations

import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Iterable, List, Sequence, Tuple

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SEARCH_COST = 100
LIST_COST = 1

QUOTA_REASONS = {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}
KEY_REASONS = {"keyInvalid", "keyExpired", "accessNotConfigured", "API_KEY_INVALID", "ipRefererBlocked"}

ERROR_MESSAGES = {
    "quotaExceeded": "등록된 모든 API 키의 오늘 할당량을 다 썼습니다. 화면 오른쪽 위 'API 키'에서 개인 키를 입력하거나, 한국 시간 오후 4~5시(태평양 자정) 이후에 다시 시도해 주세요.",
    "keyInvalid": "사용할 수 있는 API 키가 없습니다. 키가 올바른지, YouTube Data API v3가 사용 설정되었는지 확인해 주세요.",
}


class YouTubeApiError(Exception):
    """사용자에게 그대로 보여줄 수 있는 한글 메시지를 담은 오류."""


try:
    from zoneinfo import ZoneInfo

    _PACIFIC = ZoneInfo("America/Los_Angeles")
except Exception:  # Windows에 tzdata가 없을 때: 태평양 표준시로 근사
    _PACIFIC = timezone(timedelta(hours=-8))

# 서버 프로세스 전체(모든 팀원)가 공유: 오늘 할당량을 다 쓴 키는 태평양 자정까지 건너뛴다.
_exhausted: Dict[str, str] = {}
_lock = threading.Lock()


def _quota_day() -> str:
    return datetime.now(_PACIFIC).strftime("%Y-%m-%d")


def is_exhausted(key: str) -> bool:
    with _lock:
        return _exhausted.get(key) == _quota_day()


def mark_exhausted(key: str) -> None:
    with _lock:
        _exhausted[key] = _quota_day()


def _error_reason(exc: HttpError) -> str:
    try:
        return exc.error_details[0].get("reason", "") if exc.error_details else ""
    except (AttributeError, IndexError, TypeError):
        return ""


class YouTubeClient:
    """여러 API 키를 순서대로 쓰다가, 할당량이 떨어진 키는 자동으로 다음 키로 바꾼다."""

    def __init__(self, keys: Sequence[str]):
        self.keys = list(dict.fromkeys(k.strip() for k in keys if k and k.strip()))
        if not self.keys:
            raise YouTubeApiError("YouTube API 키가 설정되지 않았습니다. 화면 오른쪽 위 'API 키'에서 입력하거나 .env에 추가해 주세요.")
        self._services: Dict[str, Any] = {}
        self._invalid: set[str] = set()
        self.used_keys: List[str] = []

    def _service(self, key: str):
        if key not in self._services:
            self._services[key] = build("youtube", "v3", developerKey=key, cache_discovery=False)
        return self._services[key]

    def execute(self, make_request: Callable[[Any], Any]) -> Dict[str, Any]:
        saw_quota = False
        for key in self.keys:
            if key in self._invalid or is_exhausted(key):
                saw_quota = saw_quota or is_exhausted(key)
                continue
            try:
                response = make_request(self._service(key)).execute()
            except HttpError as exc:
                reason = _error_reason(exc)
                if reason in QUOTA_REASONS:
                    mark_exhausted(key)
                    saw_quota = True
                    continue
                # 잘못된 키는 reason이 badRequest로 오고 메시지에 "API key not valid"가 담겨 온다.
                if reason in KEY_REASONS or "api key" in str(exc).lower():
                    self._invalid.add(key)
                    continue
                raise YouTubeApiError(f"YouTube API 오류가 발생했습니다 (HTTP {exc.resp.status} {reason}).") from exc
            except OSError as exc:
                raise YouTubeApiError("네트워크 오류로 YouTube에 연결하지 못했습니다. 인터넷 연결을 확인하세요.") from exc
            if key not in self.used_keys:
                self.used_keys.append(key)
            return response
        raise YouTubeApiError(ERROR_MESSAGES["quotaExceeded" if saw_quota else "keyInvalid"])


def build_client(keys: Sequence[str] | str) -> YouTubeClient:
    return YouTubeClient([keys] if isinstance(keys, str) else keys)


def search_videos(
    client: YouTubeClient,
    query: str,
    *,
    region_code: str = "KR",
    relevance_language: str = "ko",
    order: str = "viewCount",
    max_results: int = 50,
    page_token: str | None = None,
    published_after: str | None = None,
) -> Tuple[List[Dict[str, Any]], str | None]:
    params: Dict[str, Any] = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "regionCode": region_code,
        "relevanceLanguage": relevance_language,
        "maxResults": max_results,
        "order": order,
    }
    if page_token:
        params["pageToken"] = page_token
    if published_after:
        params["publishedAfter"] = published_after
    response = client.execute(lambda s: s.search().list(**params))
    return response.get("items", []), response.get("nextPageToken")


def get_video_details(client: YouTubeClient, video_ids: Iterable[str]) -> Dict[str, Any]:
    ids = list(dict.fromkeys(video_ids))
    if not ids:
        return {}
    response = client.execute(lambda s: s.videos().list(part="snippet,statistics,contentDetails", id=",".join(ids)))
    return {item["id"]: item for item in response.get("items", [])}


def find_channel(client: YouTubeClient, **lookup: str) -> Dict[str, Any] | None:
    """id / forHandle / forUsername 중 하나로 채널 1개를 조회한다 (1 unit)."""
    response = client.execute(lambda s: s.channels().list(part="snippet,statistics,contentDetails", **lookup))
    items = response.get("items", [])
    return items[0] if items else None


def search_channel_id(client: YouTubeClient, query: str) -> str | None:
    """커스텀 URL(/c/이름)처럼 직접 조회가 안 될 때 채널 검색으로 찾는다 (100 units)."""
    response = client.execute(lambda s: s.search().list(part="snippet", q=query, type="channel", maxResults=1))
    items = response.get("items", [])
    return items[0]["id"]["channelId"] if items else None


def get_playlist_video_ids(client: YouTubeClient, playlist_id: str, page_token: str | None = None) -> Tuple[List[str], str | None]:
    params: Dict[str, Any] = {"part": "contentDetails", "playlistId": playlist_id, "maxResults": 50}
    if page_token:
        params["pageToken"] = page_token
    response = client.execute(lambda s: s.playlistItems().list(**params))
    ids = [item["contentDetails"]["videoId"] for item in response.get("items", [])]
    return ids, response.get("nextPageToken")


def get_channel_details(client: YouTubeClient, channel_ids: Iterable[str]) -> Dict[str, Any]:
    ids = list(dict.fromkeys(channel_ids))
    if not ids:
        return {}
    response = client.execute(lambda s: s.channels().list(part="snippet,statistics", id=",".join(ids)))
    return {item["id"]: item for item in response.get("items", [])}
