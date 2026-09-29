from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict

from .contacts import extract_contacts


def has_korean_text(value: str | None) -> bool:
    if not value:
        return False
    return bool(re.search(r"[가-힣]", value))


def parse_iso_duration(value: str | None) -> int:
    if not value:
        return 0
    total = 0
    match = re.search(r"(\d+)H", value)
    if match:
        total += int(match.group(1)) * 3600
    match = re.search(r"(\d+)M", value)
    if match:
        total += int(match.group(1)) * 60
    match = re.search(r"(\d+)S", value)
    if match:
        total += int(match.group(1))
    return total


def is_short_duration(seconds: int) -> bool:
    # API에 쇼츠 구분 필드가 없어 길이(3분 이하)로 추정한다.
    return 0 < seconds <= 180


def compute_ratio(view_count: Any, subscriber_count: Any) -> float:
    try:
        view_value = int(view_count or 0)
        sub_value = int(subscriber_count or 0)
    except (TypeError, ValueError):
        return 0.0
    if sub_value <= 0:
        return 0.0
    return view_value / sub_value


def is_korean_video(video_data: Dict[str, Any], channel_data: Dict[str, Any] | None = None) -> bool:
    video_snippet = video_data.get("snippet", {})
    title = video_snippet.get("title") or ""
    default_language = video_snippet.get("defaultAudioLanguage") or video_snippet.get("defaultLanguage")
    channel_snippet = (channel_data or {}).get("snippet", {}) if channel_data else {}
    channel_country = channel_snippet.get("country")

    if channel_country == "KR":
        return True
    if default_language in {"ko", "kr"}:
        return True
    if has_korean_text(title):
        return True
    return False


def is_valid_video(
    video_data: Dict[str, Any],
    channel_data: Dict[str, Any] | None,
    *,
    ratio_threshold: float = 1.0,
    min_subscribers: int = 1000,
    min_views: int = 10000,
    shorts_mode: str = "all",
) -> bool:
    stats = video_data.get("statistics", {}) if isinstance(video_data.get("statistics"), dict) else {}
    views = int(stats.get("viewCount", 0) or 0)
    channel_stats = channel_data.get("statistics", {}) if channel_data else {}
    subscribers = int(channel_stats.get("subscriberCount", 0) or 0)
    hidden = bool(channel_stats.get("hiddenSubscriberCount"))
    live_status = video_data.get("snippet", {}).get("liveBroadcastContent")

    if hidden or subscribers <= 0:
        return False
    if views < min_views:
        return False
    if subscribers < min_subscribers:
        return False
    if live_status and live_status != "none":
        return False
    if shorts_mode != "all":
        duration = parse_iso_duration(video_data.get("contentDetails", {}).get("duration"))
        if shorts_mode == "long" and is_short_duration(duration):
            return False
        if shorts_mode == "shorts" and not is_short_duration(duration):
            return False
    if not is_korean_video(video_data, channel_data):
        return False
    return compute_ratio(views, subscribers) >= ratio_threshold


def format_ratio(value: float) -> float:
    return round(value * 100, 2)


def make_result_record(video_id: str, video_data: Dict[str, Any], channel_data: Dict[str, Any] | None, ratio: float) -> Dict[str, Any]:
    snippet = video_data.get("snippet", {})
    statistics = video_data.get("statistics", {})
    channel_snippet = channel_data.get("snippet", {}) if channel_data else {}
    channel_stats = channel_data.get("statistics", {}) if channel_data else {}

    published_at = snippet.get("publishedAt") or ""
    dt = datetime.fromisoformat(published_at.replace("Z", "+00:00")) if published_at else None
    uploaded_date = dt.strftime("%Y-%m-%d") if dt else ""
    days_since_upload = max((datetime.now(timezone.utc) - dt).days, 1) if dt else 1
    view_count = int(statistics.get("viewCount", 0) or 0)
    duration_seconds = parse_iso_duration(video_data.get("contentDetails", {}).get("duration"))
    channel_id = snippet.get("channelId") or ""
    contacts = extract_contacts(channel_snippet.get("description"), snippet.get("description"))
    channel_thumbs = channel_snippet.get("thumbnails") or {}

    return {
        "emails": contacts["emails"],
        "contact_links": contacts["links"],
        "has_contact": bool(contacts["emails"] or contacts["links"]),
        "channel_thumbnail": (channel_thumbs.get("default") or {}).get("url", ""),
        "video_id": video_id,
        "title": snippet.get("title") or "",
        "channel_name": channel_snippet.get("title") or snippet.get("channelTitle") or "",
        "channel_id": channel_id,
        "channel_url": f"https://www.youtube.com/channel/{channel_id}" if channel_id else "",
        "view_count": view_count,
        "like_count": int(statistics.get("likeCount", 0) or 0),
        "comment_count": int(statistics.get("commentCount", 0) or 0),
        "subscriber_count": int(channel_stats.get("subscriberCount", 0) or 0),
        "ratio": ratio,
        "ratio_percent": format_ratio(ratio),
        "published_at": published_at,
        "uploaded_date": uploaded_date,
        "days_since_upload": days_since_upload,
        "views_per_day": round(view_count / days_since_upload),
        "duration_seconds": duration_seconds,
        "is_short": is_short_duration(duration_seconds),
        "thumbnail": (snippet.get("thumbnails") or {}).get("high", {}).get("url") or (snippet.get("thumbnails") or {}).get("default", {}).get("url") or "",
        "video_url": f"https://www.youtube.com/watch?v={video_id}",
    }
