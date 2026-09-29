from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median
from typing import Any, Dict, List, Sequence, Tuple
from urllib.parse import unquote, urlparse

from .cache import read_json_cache, write_json_cache
from .filters import is_short_duration, parse_iso_duration
from .youtube_api import (
    LIST_COST,
    SEARCH_COST,
    YouTubeApiError,
    build_client,
    find_channel,
    get_playlist_video_ids,
    get_video_details,
    search_channel_id,
)

KST = timezone(timedelta(hours=9))
RECENT_DAYS = 90
MAX_UPLOAD_PAGES = 10
FRESH_DAYS = 3
AVG_SAMPLE = 30
CACHE_TTL_HOURS = 6

HOUR_BUCKETS = ["00–03시", "03–06시", "06–09시", "09–12시", "12–15시", "15–18시", "18–21시", "21–24시"]
WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


@dataclass
class Quota:
    used: int = 0


def parse_channel_input(text: str) -> Tuple[str, str]:
    """채널 URL/핸들/ID를 (조회 방식, 값)으로 바꾼다."""
    value = unquote(text.strip())
    if not value:
        raise YouTubeApiError("채널 URL을 입력해 주세요.")
    if re.fullmatch(r"UC[\w-]{22}", value):
        return "id", value
    if value.startswith("@"):
        return "handle", value.split("/")[0]
    if "/" not in value and "." not in value:
        return "custom", value  # 채널 이름만 입력한 경우 검색으로 찾는다

    if "://" not in value:
        value = "https://" + value
    parts = [p for p in urlparse(value).path.split("/") if p]
    if not parts:
        raise YouTubeApiError(f"채널 주소를 이해하지 못했습니다: {text}")
    head = parts[0]
    if head in ("watch", "shorts", "live", "embed"):
        raise YouTubeApiError("영상 주소가 아닌 채널 주소를 넣어 주세요 (예: youtube.com/@채널핸들).")
    if head.startswith("@"):
        return "handle", head
    if head == "channel" and len(parts) > 1:
        return "id", parts[1]
    if head == "user" and len(parts) > 1:
        return "username", parts[1]
    if head == "c" and len(parts) > 1:
        return "custom", parts[1]
    return "custom", head


def resolve_channel(client, text: str, quota: Quota) -> Dict[str, Any]:
    kind, value = parse_channel_input(text)
    lookup = {"id": "id", "handle": "forHandle", "username": "forUsername"}.get(kind)
    channel = None
    if lookup:
        channel = find_channel(client, **{lookup: value})
        quota.used += LIST_COST
    if channel is None:
        channel_id = search_channel_id(client, value)
        quota.used += SEARCH_COST
        if channel_id:
            channel = find_channel(client, id=channel_id)
            quota.used += LIST_COST
    if channel is None:
        raise YouTubeApiError(f"채널을 찾지 못했습니다: {text}")
    return channel


def _simplify_video(item: Dict[str, Any]) -> Dict[str, Any]:
    snippet = item.get("snippet", {})
    stats = item.get("statistics", {})
    duration = parse_iso_duration(item.get("contentDetails", {}).get("duration"))
    thumbs = snippet.get("thumbnails") or {}
    return {
        "video_id": item["id"],
        "title": snippet.get("title", ""),
        "published_at": snippet.get("publishedAt", ""),
        "view_count": int(stats.get("viewCount", 0) or 0),
        "like_count": int(stats.get("likeCount", 0) or 0),
        "comment_count": int(stats.get("commentCount", 0) or 0),
        "duration_seconds": duration,
        "is_short": is_short_duration(duration),
        "thumbnail": (thumbs.get("medium") or thumbs.get("high") or thumbs.get("default") or {}).get("url", ""),
        "video_url": f"https://www.youtube.com/watch?v={item['id']}",
    }


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fetch_uploads(client, uploads_playlist_id: str, quota: Quota) -> List[Dict[str, Any]]:
    """업로드 목록을 최신순으로 최대 500개(10페이지) 가져온다. 페이지당 2 units."""
    videos: List[Dict[str, Any]] = []
    page_token = None
    for _ in range(MAX_UPLOAD_PAGES):
        ids, page_token = get_playlist_video_ids(client, uploads_playlist_id, page_token)
        details = get_video_details(client, ids)
        quota.used += LIST_COST * 2
        videos.extend(
            _simplify_video(details[i]) for i in ids
            if i in details and details[i].get("snippet", {}).get("liveBroadcastContent", "none") == "none"
        )
        if not page_token:
            break
    return videos


def top_videos(videos: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
    # search.list의 order=viewCount는 채널 필터와 함께 쓰면 최신 영상 위주로 나와 믿기 어렵다.
    # 그래서 가져온 업로드 목록 안에서 직접 정렬한다.
    return sorted(videos, key=lambda v: -v["view_count"])[:limit]


def analyze_channel(text: str, api_keys: Sequence[str] | str) -> Tuple[Dict[str, Any], int]:
    """채널 1개의 기본 정보, 최근 업로드, 인기 영상을 모은다. (데이터, 사용 쿼터)를 반환."""
    kind, value = parse_channel_input(text)
    cache_key = re.sub(r"[^\w@-]", "_", f"{kind}_{value}".lower())
    cached = read_json_cache("channels", cache_key, CACHE_TTL_HOURS)
    if cached is not None:
        return cached, 0

    client = build_client(api_keys)
    quota = Quota()
    channel = resolve_channel(client, text, quota)
    snippet = channel.get("snippet", {})
    stats = channel.get("statistics", {})
    uploads = channel.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    thumbs = snippet.get("thumbnails") or {}

    report = {
        "channel_id": channel["id"],
        "title": snippet.get("title", ""),
        "handle": snippet.get("customUrl", ""),
        "thumbnail": (thumbs.get("medium") or thumbs.get("default") or {}).get("url", ""),
        "channel_url": f"https://www.youtube.com/channel/{channel['id']}",
        "subscriber_count": int(stats.get("subscriberCount", 0) or 0),
        "subscribers_hidden": bool(stats.get("hiddenSubscriberCount")),
        "total_views": int(stats.get("viewCount", 0) or 0),
        "video_count": int(stats.get("videoCount", 0) or 0),
        "videos": fetch_uploads(client, uploads, quota) if uploads else [],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }
    write_json_cache("channels", cache_key, report)
    return report, quota.used


def filter_kind(videos: List[Dict[str, Any]], kind: str) -> List[Dict[str, Any]]:
    if kind == "long":
        return [v for v in videos if not v["is_short"]]
    if kind == "shorts":
        return [v for v in videos if v["is_short"]]
    return videos


def summarize(videos: List[Dict[str, Any]]) -> Dict[str, float]:
    """최근 영상 30개 평균 조회수(업로드 3일 이내 제외)와 최근 90일 주간 업로드 수. videos는 최신순."""
    now = datetime.now(timezone.utc)
    matured = [v["view_count"] for v in videos if (now - _parse_time(v["published_at"])).days >= FRESH_DAYS][:AVG_SAMPLE]
    recent = [v for v in videos if (now - _parse_time(v["published_at"])).days < RECENT_DAYS]
    return {
        "avg_views": sum(matured) / len(matured) if matured else 0.0,
        "median_views": median(matured) if matured else 0.0,
        "uploads_per_week": len(recent) / (RECENT_DAYS / 7),
        "sample_size": len(matured),
    }


def timing_breakdown(videos: List[Dict[str, Any]], by: str = "hour") -> List[Dict[str, Any]]:
    """업로드 시각(KST)별 영상 수, 평균 조회수, 채널 평균 대비 비율."""
    now = datetime.now(timezone.utc)
    matured = [v for v in videos if (now - _parse_time(v["published_at"])).days >= FRESH_DAYS]
    if not matured:
        return []
    overall = sum(v["view_count"] for v in matured) / len(matured)
    labels = HOUR_BUCKETS if by == "hour" else WEEKDAYS
    groups: Dict[str, List[int]] = {label: [] for label in labels}
    for v in matured:
        local = _parse_time(v["published_at"]).astimezone(KST)
        label = HOUR_BUCKETS[local.hour // 3] if by == "hour" else WEEKDAYS[local.weekday()]
        groups[label].append(v["view_count"])
    rows = []
    for label in labels:
        views = groups[label]
        avg = sum(views) / len(views) if views else 0.0
        rows.append({
            "bucket": label,
            "count": len(views),
            "avg_views": avg,
            "index": (avg / overall * 100) if views and overall else 0.0,
        })
    return rows
