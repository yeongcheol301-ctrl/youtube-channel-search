from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List

from .config import FinderConfig

# YouTube API 약관: 수집 데이터는 30일을 넘겨 보관하지 않는다.
MAX_CACHE_AGE_DAYS = 30


def get_cache_dir() -> Path:
    return Path(__file__).resolve().parent.parent / ".cache"


def make_cache_key(keyword: str, config: FinderConfig) -> str:
    # 필터 조건이 다르면 다른 캐시를 쓰도록 키워드와 설정값을 함께 해시한다.
    # 우선순위는 검색 범위를 바꾸므로 키에 포함된다.
    settings = {k: v for k, v in asdict(config).items() if k != "cache_ttl_hours"}
    payload = json.dumps({"keyword": keyword.strip().lower(), "config": settings}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def purge_old_cache() -> None:
    cache_dir = get_cache_dir()
    if not cache_dir.exists():
        return
    cutoff = time.time() - MAX_CACHE_AGE_DAYS * 86400
    for path in cache_dir.rglob("*.json"):
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
        except OSError:
            pass


def _cache_path(namespace: str, key: str) -> Path:
    directory = get_cache_dir() / namespace
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{key}.json"


def read_json_cache(namespace: str, key: str, ttl_hours: int) -> Any | None:
    path = _cache_path(namespace, key)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        timestamp = datetime.fromisoformat(payload["cached_at"])
    except (json.JSONDecodeError, OSError, KeyError, ValueError):
        return None
    if datetime.now() - timestamp > timedelta(hours=ttl_hours):
        return None
    return payload.get("data")


def write_json_cache(namespace: str, key: str, data: Any) -> None:
    purge_old_cache()
    payload = {"cached_at": datetime.now().isoformat(), "data": data}
    _cache_path(namespace, key).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_cache(keyword: str, config: FinderConfig) -> List[Dict[str, Any]] | None:
    return read_json_cache("search", make_cache_key(keyword, config), config.cache_ttl_hours)


def write_cache(keyword: str, config: FinderConfig, results: List[Dict[str, Any]]) -> None:
    write_json_cache("search", make_cache_key(keyword, config), results)
