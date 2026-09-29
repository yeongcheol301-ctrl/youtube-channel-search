from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Sequence

from .cache import read_cache, write_cache
from .config import FinderConfig, get_api_keys
from .filters import compute_ratio, is_valid_video, make_result_record
from .youtube_api import (
    LIST_COST,
    SEARCH_COST,
    build_client,
    get_channel_details,
    get_video_details,
    search_videos,
)

SORT_KEYS = {
    "ratio": lambda row: (-row["ratio"], -row["view_count"]),
    "views": lambda row: (-row["view_count"], -row["ratio"]),
    "subscribers": lambda row: (-row["subscriber_count"], -row["view_count"]),
    "views_per_day": lambda row: (-row["views_per_day"], -row["ratio"]),
    "latest": lambda row: (row["published_at"] == "", -_timestamp(row["published_at"])),
}


def _timestamp(value: str) -> float:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() if value else 0.0


@dataclass
class FinderResult:
    videos: List[Dict[str, Any]] = field(default_factory=list)
    quota_used: int = 0
    candidates_scanned: int = 0
    from_cache: bool = False


def sort_results(results: List[Dict[str, Any]], sort_by: str) -> List[Dict[str, Any]]:
    return sorted(results, key=SORT_KEYS.get(sort_by, SORT_KEYS["ratio"]))


def collect_videos(
    keyword: str,
    *,
    config: FinderConfig | None = None,
    api_keys: Sequence[str] | str | None = None,
) -> FinderResult:
    config = config or FinderConfig()

    cached = read_cache(keyword, config)
    if cached is not None:
        return FinderResult(videos=sort_results(cached, config.priority), from_cache=True)

    published_after = None
    if config.published_within_days:
        since = datetime.now(timezone.utc) - timedelta(days=config.published_within_days)
        published_after = since.strftime("%Y-%m-%dT%H:%M:%SZ")

    client = build_client(api_keys or get_api_keys())
    outcome = FinderResult()
    per_channel: Counter[str] = Counter()
    page_token: str | None = None

    for _ in range(config.max_pages):
        items, next_page_token = search_videos(
            client,
            keyword,
            region_code=config.region_code,
            relevance_language=config.relevance_language,
            order=config.order,
            max_results=config.max_results_per_page,
            page_token=page_token,
            published_after=published_after,
        )
        outcome.quota_used += SEARCH_COST

        if not items:
            break

        video_ids = [entry["id"]["videoId"] for entry in items if entry.get("id", {}).get("videoId")]
        outcome.candidates_scanned += len(video_ids)
        video_details = get_video_details(client, video_ids)
        outcome.quota_used += LIST_COST

        channel_ids = [v["snippet"]["channelId"] for v in video_details.values() if v.get("snippet", {}).get("channelId")]
        channel_details = get_channel_details(client, channel_ids)
        outcome.quota_used += LIST_COST

        for video_id in video_ids:
            video_data = video_details.get(video_id)
            if not video_data:
                continue

            channel_id = video_data.get("snippet", {}).get("channelId")
            channel_data = channel_details.get(channel_id) if channel_id else None
            if not channel_data or per_channel[channel_id] >= config.max_per_channel:
                continue

            if not is_valid_video(
                video_data,
                channel_data,
                ratio_threshold=config.ratio_threshold,
                min_subscribers=config.min_subscribers,
                min_views=config.min_views,
                shorts_mode=config.shorts_mode,
            ):
                continue

            ratio = compute_ratio(
                video_data.get("statistics", {}).get("viewCount"),
                channel_data.get("statistics", {}).get("subscriberCount"),
            )
            record = make_result_record(video_id, video_data, channel_data, ratio)
            if config.contact_only and not record["has_contact"]:
                continue
            outcome.videos.append(record)
            per_channel[channel_id] += 1

            if config.stop_when_full and len(outcome.videos) >= config.max_results:
                break

        if (config.stop_when_full and len(outcome.videos) >= config.max_results) or not next_page_token:
            break

        page_token = next_page_token

    # 우선순위가 API 검색 순서와 다르면(비율·구독자수) 모든 후보 중에서 상위 N개를 고른다.
    outcome.videos = sort_results(outcome.videos, config.priority)[: config.max_results]
    write_cache(keyword, config, outcome.videos)
    return outcome
