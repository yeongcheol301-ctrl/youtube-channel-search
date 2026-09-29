from __future__ import annotations

import argparse

from yt_finder.config import FinderConfig
from yt_finder.exporter import export_csv
from yt_finder.finder import collect_videos
from yt_finder.youtube_api import YouTubeApiError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="유튜브 조회수/구독자 비율 기반 영상 탐색기")
    parser.add_argument("keyword", help="검색 키워드")
    parser.add_argument("--min-subscribers", type=int, default=1000, help="최소 구독자수")
    parser.add_argument("--min-views", type=int, default=10000, help="최소 조회수")
    parser.add_argument("--ratio-threshold", type=float, default=1.0, help="최소 비율 (예: 1.0 = 100%)")
    parser.add_argument("--max-results", type=int, default=30, help="최대 결과 수")
    parser.add_argument("--days", type=int, default=30, help="최근 N일 이내 업로드 (0 = 전체 기간)")
    parser.add_argument("--shorts", choices=["all", "long", "shorts"], default="all", help="영상 종류")
    parser.add_argument(
        "--priority", choices=["ratio", "views", "subscribers", "latest"], default="ratio",
        help="우선순위 (검색 범위와 결과 순서를 함께 정함)",
    )
    parser.add_argument("--contact-only", action="store_true", help="공개 연락처가 있는 채널만")
    parser.add_argument("--max-per-channel", type=int, default=1, help="채널당 최대 영상 수")
    parser.add_argument("--csv-output", help="CSV 저장 경로")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    config = FinderConfig(
        min_subscribers=args.min_subscribers,
        min_views=args.min_views,
        ratio_threshold=args.ratio_threshold,
        max_results=args.max_results,
        published_within_days=args.days or None,
        shorts_mode=args.shorts,
        priority=args.priority,
        contact_only=args.contact_only,
        max_per_channel=args.max_per_channel,
    )

    try:
        outcome = collect_videos(args.keyword, config=config)
    except YouTubeApiError as exc:
        raise SystemExit(str(exc)) from exc

    results = outcome.videos
    source = "캐시" if outcome.from_cache else f"후보 {outcome.candidates_scanned}개 검사, API 약 {outcome.quota_used} units 사용"
    print(f"검색 키워드: {args.keyword} ({source})")

    if not results:
        print(f"'{args.keyword}'에 대한 조건에 맞는 영상이 없습니다.")
        return

    print(f"조건에 맞는 영상 수: {len(results)}")
    for index, row in enumerate(results, start=1):
        print(
            f"{index}. {row['title']} | {row['channel_name']} | 조회수={row['view_count']:,} | "
            f"구독자={row['subscriber_count']:,} | 비율={row['ratio_percent']:.0f}% | "
            f"일평균={row['views_per_day']:,} | {row['uploaded_date']} | {row['video_url']}"
        )
        contacts = row.get("emails", []) + [link["url"] for link in row.get("contact_links", [])]
        if contacts:
            print(f"   컨택: {', '.join(contacts)}")

    if args.csv_output:
        export_csv(results, args.csv_output)
        print(f"CSV 저장 완료: {args.csv_output}")


if __name__ == "__main__":
    main()
