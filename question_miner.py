"""질문 댓글 수집기: 떡상 쇼츠의 댓글에서 '사람들이 이미 궁금해하는 것'을 뽑아 소재 후보로 만든다.

예) python question_miner.py 현실판정소
    python question_miner.py 자본주의해부도 --refresh --method browser
"""
from __future__ import annotations

import argparse
import csv
from datetime import date
from pathlib import Path
from typing import Any, Dict, List

from yt_finder.config import FinderConfig, get_api_keys
from yt_finder.finder import collect_videos
from yt_finder.questions import CHANNEL_KEYWORDS, fetch_comments_api, fetch_comments_browser, mine_questions
from yt_finder.youtube_api import YouTubeApiError, build_client

ROOT = Path(__file__).parent
SHEET_DIR = ROOT / "docs" / "channels" / "answer_sheet"
OUT_DIR = ROOT / "docs" / "channels" / "소재후보"


def load_sheet(keyword: str) -> List[Dict[str, Any]]:
    path = SHEET_DIR / f"{keyword}.csv"
    if not path.exists():
        return []
    with path.open(encoding="utf-8-sig") as f:
        return [
            {"video_id": r["video_id"], "title": r["title"], "view_count": int(r["view_count"]), "ratio": float(r["ratio"])}
            for r in csv.DictReader(f)
        ]


def search_fresh(keyword: str) -> List[Dict[str, Any]]:
    """답안지 수집과 같은 조건으로 새로 검색 (키워드당 100~300 units)."""
    config = FinderConfig(
        min_subscribers=1000, min_views=0, ratio_threshold=0, max_results=50,
        published_within_days=365, shorts_mode="shorts", priority="views", max_per_channel=3,
    )
    return collect_videos(keyword, config=config).videos


def pick_videos(keywords: List[str], per_keyword: int, refresh: bool) -> List[Dict[str, Any]]:
    """키워드마다 구독자 대비 조회수 상위 N편 (떡상 쪽)만 고른다."""
    picked: Dict[str, Dict[str, Any]] = {}
    for keyword in keywords:
        videos = [] if refresh else load_sheet(keyword)
        if not videos:
            videos = search_fresh(keyword)
        for video in sorted(videos, key=lambda v: v["ratio"], reverse=True)[:per_keyword]:
            picked.setdefault(video["video_id"], {**video, "keyword": keyword})
    return list(picked.values())


def write_outputs(channel: str, rows: List[Dict[str, Any]], top: int) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = OUT_DIR / f"{channel}_{date.today():%Y-%m-%d}"
    fields = ["question", "likes", "keyword", "video_title", "video_views", "video_url"]
    with stem.with_suffix(".csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    lines = [
        f"# {channel} 소재 후보 ({date.today():%Y-%m-%d})",
        "",
        "> 떡상 쇼츠 댓글 중 질문형만, 좋아요 순. 질문 = 시청자가 이미 궁금해하는 것 = 반응 검증 통과 후보.",
        "> 그대로 쓰지 말고 팩트체크 후 문장은 새로 쓴다.",
        "",
        "| 좋아요 | 질문 댓글 | 나온 영상 |",
        "|---|---|---|",
    ]
    for r in rows[:top]:
        question = r["question"].replace("|", "/")[:120]
        title = r["video_title"].replace("|", "/")[:40]
        lines.append(f"| {r['likes']:,} | {question} | [{title}]({r['video_url']}) |")
    stem.with_suffix(".md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return stem.with_suffix(".md")


def main() -> None:
    parser = argparse.ArgumentParser(description="떡상 쇼츠 댓글에서 질문형 댓글을 뽑아 소재 후보를 만든다")
    parser.add_argument("channel", choices=list(CHANNEL_KEYWORDS), help="채널 이름 (기본 키워드 묶음)")
    parser.add_argument("--keywords", nargs="+", help="기본 키워드 대신 쓸 키워드")
    parser.add_argument("--per-keyword", type=int, default=5, help="키워드당 댓글을 볼 떡상 영상 수")
    parser.add_argument("--refresh", action="store_true", help="저장된 답안지 대신 새로 검색")
    parser.add_argument("--method", choices=["auto", "api", "browser"], default="auto",
                        help="auto = API로 하다가 한도가 차면 ego-browser")
    parser.add_argument("--top", type=int, default=50, help="문서에 적을 질문 수")
    args = parser.parse_args()

    keywords = args.keywords or CHANNEL_KEYWORDS[args.channel]
    try:
        videos = pick_videos(keywords, args.per_keyword, args.refresh)
    except YouTubeApiError as exc:
        raise SystemExit(f"영상 검색 실패: {exc}") from exc
    print(f"댓글을 볼 영상: {len(videos)}편 (키워드 {len(keywords)}개)")

    rows: List[Dict[str, Any]] = []
    if args.method in ("auto", "api"):
        client = build_client(get_api_keys())
        try:
            rows = mine_questions(videos, lambda vid: fetch_comments_api(client, vid))
        except YouTubeApiError as exc:
            if args.method == "api":
                raise SystemExit(str(exc)) from exc
            print(f"API 사용 불가 → ego-browser로 전환합니다. ({exc})")
            args.method = "browser"
    if args.method == "browser":
        comments = fetch_comments_browser(v["video_id"] for v in videos)
        rows = mine_questions(videos, lambda vid: comments.get(vid, []))

    path = write_outputs(args.channel, rows, args.top)
    print(f"질문 댓글 {len(rows)}개 → {path}")


if __name__ == "__main__":
    main()
