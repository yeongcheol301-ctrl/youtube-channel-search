from yt_finder.filters import compute_ratio, has_korean_text, is_valid_video


def test_compute_ratio_basic():
    assert compute_ratio(200000, 100000) == 2.0
    assert compute_ratio(100, 0) == 0.0


def test_has_korean_text():
    assert has_korean_text("캠핑 요리 꿀팁") is True
    assert has_korean_text("camping tips") is False


def test_is_valid_video_rejects_hidden_subscribers():
    video = {
        "snippet": {"title": "캠핑 요리 꿀팁", "liveBroadcastContent": "none"},
        "statistics": {"viewCount": "500000"},
        "contentDetails": {"duration": "PT10M"},
    }
    channel = {
        "statistics": {"subscriberCount": "5000", "hiddenSubscriberCount": True},
        "snippet": {"title": "테스트채널", "country": "KR"},
    }

    assert is_valid_video(video, channel, ratio_threshold=1.0, min_subscribers=1000, min_views=10000) is False


def test_is_valid_video_accepts_good_candidate():
    video = {
        "snippet": {"title": "캠핑 요리 쉽게 하는 법", "liveBroadcastContent": "none"},
        "statistics": {"viewCount": "200000"},
        "contentDetails": {"duration": "PT5M"},
    }
    channel = {
        "statistics": {"subscriberCount": "100000", "hiddenSubscriberCount": False},
        "snippet": {"title": "캠핑채널", "country": "KR"},
    }

    assert is_valid_video(video, channel, ratio_threshold=1.0, min_subscribers=1000, min_views=10000) is True


def _candidate(duration: str):
    video = {
        "snippet": {"title": "캠핑 요리", "liveBroadcastContent": "none"},
        "statistics": {"viewCount": "200000"},
        "contentDetails": {"duration": duration},
    }
    channel = {"statistics": {"subscriberCount": "100000"}, "snippet": {"country": "KR"}}
    return video, channel


def test_shorts_mode_filters_by_duration():
    short_video, channel = _candidate("PT45S")
    long_video, _ = _candidate("PT12M")

    assert is_valid_video(short_video, channel, shorts_mode="all") is True
    assert is_valid_video(short_video, channel, shorts_mode="long") is False
    assert is_valid_video(short_video, channel, shorts_mode="shorts") is True
    assert is_valid_video(long_video, channel, shorts_mode="shorts") is False
    assert is_valid_video(long_video, channel, shorts_mode="long") is True
