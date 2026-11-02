import pytest

from yt_finder.questions import is_question, mine_questions, parse_likes


@pytest.mark.parametrize("text", [
    "현실이면 저거 가능함?",
    "이거 무슨 원리인지 아는 사람",
    "고층이 진짜 더 위험한 건가요",
    "반지는 왜 가라앉는 걸까",
    "이런 신기술이 있으면서 집을 왜그렇게 춥게 지음?",
])
def test_question_comments_are_kept(text):
    assert is_question(text)


@pytest.mark.parametrize("text", [
    "주성치 개그는 언제 봐도 꿀잼이네 ㅋㅋ",
    "한눈팔기가 왜 성공해 ㅋㅋㅋ",  # 감탄이지 질문이 아님
    "이진호 팔 개아프겠는데?ㅋㅋㅋㅋ",  # 물음표만 있는 반응
    "저건 절세가아니라 탈세다 열심히 소득세내는 직장인들 기만하는거임",
    "ㅋㅋㅋㅋ?",
    "왜?",  # 너무 짧음
    "",
])
def test_non_questions_are_dropped(text):
    assert not is_question(text)


@pytest.mark.parametrize("raw, expected", [
    (123, 123), ("902", 902), ("3.5천", 3500), ("1.9만", 19000), ("1,177", 1177), ("", 0), ("abc", 0),
])
def test_parse_likes(raw, expected):
    assert parse_likes(raw) == expected


def test_mine_questions_filters_and_sorts_by_likes():
    videos = [{"video_id": "a", "title": "A", "keyword": "k", "view_count": 10}]
    comments = {"a": [
        {"text": "재밌다 ㅋㅋ", "likes": 999},
        {"text": "이게 현실에서 가능함?", "likes": 5},
        {"text": "왜 저렇게 하는 건가요", "likes": 50},
    ]}
    rows = mine_questions(videos, lambda vid: comments[vid])
    assert [r["likes"] for r in rows] == [50, 5]
    assert rows[0]["video_url"] == "https://www.youtube.com/watch?v=a"
    assert rows[0]["keyword"] == "k"


def test_mine_questions_caps_each_video():
    videos = [{"video_id": "a", "title": "A"}]
    comments = [{"text": f"이거 진짜 가능한가요 {i}", "likes": i} for i in range(10)]
    rows = mine_questions(videos, lambda vid: comments)
    assert [r["likes"] for r in rows] == [9, 8, 7, 6, 5]
