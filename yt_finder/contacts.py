from __future__ import annotations

import re
from typing import Dict, List
from urllib.parse import urlparse

# 유튜브의 "비즈니스 문의 이메일"(채널 정보 탭의 '이메일 주소 보기')은 API로 제공되지 않는다.
# 그래서 채널 설명과 영상 설명란에 공개된 연락처만 모은다.

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
URL_RE = re.compile(r"(?:https?://|www\.)[^\s<>()\"'\]]+|(?:instagram\.com|open\.kakao\.com|linktr\.ee|litt\.ly|inpk\.link)/[^\s<>()\"'\]]+", re.I)
IGNORED_EMAIL_DOMAINS = ("example.com", "sentry.io", "wixpress.com")

LINK_TYPES = [
    ("instagram", "Instagram", ("instagram.com",)),
    ("kakao", "카카오톡", ("open.kakao.com", "pf.kakao.com")),
    ("linktree", "링크모음", ("linktr.ee", "litt.ly", "inpk.link", "beacons.ai", "bio.link")),
    ("tiktok", "TikTok", ("tiktok.com",)),
    ("blog", "블로그", ("blog.naver.com", "tistory.com", "brunch.co.kr")),
    ("form", "문의 폼", ("forms.gle", "docs.google.com/forms", "naver.me", "form.naver.com")),
]
SKIPPED_HOSTS = ("youtube.com", "youtu.be", "coupa.ng", "link.coupang.com", "smartstore.naver.com", "bit.ly")


def _normalize_url(raw: str) -> str:
    url = raw.rstrip(".,;:!?)]}>'\"")
    if not url.lower().startswith("http"):
        url = "https://" + url
    return url


def _classify(url: str):
    lowered = url.lower()
    for key, label, hosts in LINK_TYPES:
        if any(host in lowered for host in hosts):
            return key, label
    return None


def extract_contacts(*texts: str | None) -> Dict[str, List]:
    """설명란 텍스트들에서 이메일과 연락용 링크를 뽑는다."""
    body = "\n".join(t for t in texts if t)
    emails: List[str] = []
    for match in EMAIL_RE.findall(body):
        email = match.strip(".").lower()
        if email not in emails and not email.endswith(IGNORED_EMAIL_DOMAINS):
            emails.append(email)

    links: List[Dict[str, str]] = []
    seen = set()
    for raw in URL_RE.findall(body):
        url = _normalize_url(raw)
        host = urlparse(url).netloc.lower().removeprefix("www.")
        if any(host.endswith(skip) for skip in SKIPPED_HOSTS):
            continue
        kind = _classify(url)
        if not kind:
            continue
        key, label = kind
        identity = url.split("?")[0].rstrip("/").lower()
        if key == "instagram":
            handle = urlparse(url).path.strip("/").split("/")[0]
            if not handle or handle in ("p", "reel", "reels", "stories", "explore"):
                continue
            label = f"@{handle}"
            identity = f"instagram:{handle.lower()}"
        if identity in seen:
            continue
        seen.add(identity)
        links.append({"type": key, "label": label, "url": url})

    order = [key for key, _, _ in LINK_TYPES]
    links.sort(key=lambda link: order.index(link["type"]))
    return {"emails": emails[:3], "links": links[:4]}
