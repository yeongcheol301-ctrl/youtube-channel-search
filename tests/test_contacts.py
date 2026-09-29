from yt_finder.contacts import extract_contacts


def test_extracts_email_and_instagram_from_descriptions():
    channel = "캠핑 브이로그 채널입니다.\n비즈니스 문의: Camp.Lover@naver.com\n인스타 https://www.instagram.com/camp_lover/?hl=ko"
    video = "협찬 문의는 camp.lover@naver.com 으로! instagram.com/camp_lover 쿠팡 https://link.coupang.com/a/xyz"
    result = extract_contacts(channel, video)

    assert result["emails"] == ["camp.lover@naver.com"]
    assert [link["label"] for link in result["links"]] == ["@camp_lover"]


def test_extracts_kakao_and_linktree_in_priority_order():
    text = "링크 모음 https://linktr.ee/someone\n오픈채팅 https://open.kakao.com/o/abc123."
    result = extract_contacts(text)

    assert [link["type"] for link in result["links"]] == ["kakao", "linktree"]
    assert result["links"][0]["url"] == "https://open.kakao.com/o/abc123"


def test_ignores_video_links_and_instagram_posts():
    text = "https://youtu.be/xyz https://www.instagram.com/p/Cabc/ https://www.youtube.com/@me"
    assert extract_contacts(text) == {"emails": [], "links": []}
