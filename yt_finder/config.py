from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, List


SHORTS_MODES = ("all", "long", "shorts")

# 우선순위 → (YouTube 검색 정렬 방식, 목표 개수를 채우면 바로 멈춰도 되는지)
# 검색 정렬이 우선순위와 같으면 앞에서부터 채우면 되지만, API에 없는 기준(구독자수, 비율)은
# 후보를 끝까지 모은 뒤 골라야 우선순위가 제대로 반영된다.
PRIORITY_SEARCH = {
    "ratio": ("viewCount", False),
    "views": ("viewCount", True),
    "subscribers": ("relevance", False),
    "latest": ("date", True),
}


@dataclass(frozen=True)
class FinderConfig:
    region_code: str = "KR"
    relevance_language: str = "ko"
    min_subscribers: int = 1000
    min_views: int = 10000
    ratio_threshold: float = 1.0
    max_results: int = 30
    max_pages: int = 5
    max_results_per_page: int = 50
    cache_ttl_hours: int = 6
    published_within_days: int | None = 30
    max_per_channel: int = 1
    shorts_mode: str = "all"
    priority: str = "ratio"
    contact_only: bool = False

    @property
    def order(self) -> str:
        return PRIORITY_SEARCH.get(self.priority, PRIORITY_SEARCH["ratio"])[0]

    @property
    def stop_when_full(self) -> bool:
        return PRIORITY_SEARCH.get(self.priority, PRIORITY_SEARCH["ratio"])[1]


def _split_keys(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    return [part.strip() for part in str(value).split(",") if part.strip()]


def get_shared_api_keys() -> List[str]:
    """공용 키 목록: .env 또는 Streamlit Secrets의 YOUTUBE_API_KEYS(쉼표 구분) + YOUTUBE_API_KEY."""
    from dotenv import load_dotenv

    load_dotenv()
    keys = _split_keys(os.getenv("YOUTUBE_API_KEYS")) + _split_keys(os.getenv("YOUTUBE_API_KEY"))
    try:
        import streamlit as st

        keys += _split_keys(st.secrets.get("YOUTUBE_API_KEYS")) + _split_keys(st.secrets.get("YOUTUBE_API_KEY"))
    except Exception:
        pass
    return list(dict.fromkeys(keys))


def get_api_keys(personal_key: str | None = None) -> List[str]:
    """개인 키가 있으면 가장 먼저 쓰고, 다 떨어지면 공용 키로 넘어간다."""
    personal = [personal_key.strip()] if personal_key and personal_key.strip() else []
    return list(dict.fromkeys(personal + get_shared_api_keys()))


def build_default_config() -> FinderConfig:
    return FinderConfig()
