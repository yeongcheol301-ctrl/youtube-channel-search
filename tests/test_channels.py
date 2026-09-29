from datetime import datetime, timedelta, timezone

import pytest

from yt_finder.channels import parse_channel_input, summarize, timing_breakdown
from yt_finder.youtube_api import YouTubeApiError


@pytest.mark.parametrize(
    "text, expected",
    [
        ("https://www.youtube.com/@syukaworld", ("handle", "@syukaworld")),
        ("youtube.com/@syukaworld/videos", ("handle", "@syukaworld")),
        ("@syukaworld", ("handle", "@syukaworld")),
        ("https://www.youtube.com/channel/UCsJ6RuBiTVWRX156FVbeaGg", ("id", "UCsJ6RuBiTVWRX156FVbeaGg")),
        ("UCsJ6RuBiTVWRX156FVbeaGg", ("id", "UCsJ6RuBiTVWRX156FVbeaGg")),
        ("https://www.youtube.com/user/someone", ("username", "someone")),
        ("https://www.youtube.com/c/SomeName", ("custom", "SomeName")),
        ("https://www.youtube.com/@%EC%B9%A8%EC%B0%A9%EB%A7%A8", ("handle", "@침착맨")),
        ("슈카월드", ("custom", "슈카월드")),
    ],
)
def test_parse_channel_input(text, expected):
    assert parse_channel_input(text) == expected


def test_parse_channel_input_rejects_video_url():
    with pytest.raises(YouTubeApiError):
        parse_channel_input("https://www.youtube.com/watch?v=abc")


def _video(hours_ago: int, kst_hour: int, views: int):
    kst = timezone(timedelta(hours=9))
    day = datetime.now(kst) - timedelta(hours=hours_ago)
    published = day.replace(hour=kst_hour, minute=0, second=0).astimezone(timezone.utc)
    return {"published_at": published.isoformat().replace("+00:00", "Z"), "view_count": views, "is_short": False}


def test_timing_breakdown_buckets_by_kst_hour():
    videos = [_video(24 * 10, 19, 300), _video(24 * 11, 20, 100), _video(24 * 12, 8, 200)]
    rows = {r["bucket"]: r for r in timing_breakdown(videos, by="hour")}
    assert rows["18–21시"]["count"] == 2
    assert rows["18–21시"]["avg_views"] == 200
    assert rows["06–09시"]["index"] == pytest.approx(100.0)
    assert rows["00–03시"]["count"] == 0


def test_summarize_excludes_fresh_videos_from_average():
    videos = [_video(24 * 10, 12, 1000), _video(5, 12, 10)]
    summary = summarize(videos)
    assert summary["avg_views"] == 1000
    assert summary["sample_size"] == 1
    assert summary["uploads_per_week"] == pytest.approx(2 / (90 / 7))
