from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List

from .youtube_api import YouTubeApiError, YouTubeClient

# 채널별 기본 키워드 (답안지에서 우리 장르와 맞던 키워드). 예능 클립이 섞이던 '알고 보면'은 뺐다.
CHANNEL_KEYWORDS: Dict[str, List[str]] = {
    "현실판정소": [
        "영화 고증", "영화 실험", "영화 실제 사건", "영화 장면 현실",
        "영화 현실 가능", "액션 영화 현실", "히어로 현실", "만화 현실 가능",
    ],
    "자본주의해부도": [
        "돈 버는 구조", "건물 이유", "건축 비밀", "가격의 비밀",
        "세금 이유", "아파트 비밀", "숨은 이유", "이유를 아시나요",
    ],
}

# 궁금증 단어와 묻는 말투가 둘 다 있어야 질문으로 본다. 물음표만 있는 의견·비난 댓글은 걸러진다.
CURIOUS_WORDS = re.compile(r"왜|어떻게|어케|가능|궁금|원리|이유|현실에서|실제로|진짜|정말|무슨|뭐(임|야|지)")
ASKING = re.compile(r"\?|까요?|나요|가요|건가|건지|는지|냐|아는 ?사람|궁금")
MAX_PER_VIDEO = 5
# 웃음만 있는 짧은 댓글("ㅋㅋㅋ?")은 질문이 아니다.
_LAUGH_ONLY = re.compile(r"^[ㅋㅎㄷ!?.~\s]+$")


def is_question(text: str) -> bool:
    text = (text or "").strip()
    if len(text) < 6 or _LAUGH_ONLY.match(text):
        return False
    return bool(CURIOUS_WORDS.search(text) and ASKING.search(text))


def parse_likes(value: Any) -> int:
    """API 숫자(123) 또는 화면 표기('1.9만', '3.5천', '902')를 정수로."""
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value or "").replace(",", "").strip()
    if not text:
        return 0
    for unit, mult in (("만", 10_000), ("천", 1_000)):
        if text.endswith(unit):
            try:
                return int(float(text[:-1]) * mult)
            except ValueError:
                return 0
    try:
        return int(float(text))
    except ValueError:
        return 0


def fetch_comments_api(client: YouTubeClient, video_id: str, max_results: int = 100) -> List[Dict[str, Any]]:
    """인기순 상위 댓글 (1 unit). 댓글이 꺼진 영상은 빈 목록."""
    try:
        response = client.execute(
            lambda s: s.commentThreads().list(
                part="snippet", videoId=video_id, order="relevance",
                maxResults=max_results, textFormat="plainText",
            )
        )
    except YouTubeApiError as exc:
        if "commentsDisabled" in str(exc) or "HTTP 403" in str(exc) or "HTTP 404" in str(exc):
            return []
        raise
    comments = []
    for item in response.get("items", []):
        top = item["snippet"]["topLevelComment"]["snippet"]
        comments.append({"text": top.get("textDisplay", ""), "likes": int(top.get("likeCount", 0))})
    return comments


_BROWSER_SCRIPT = """
const fs = await import("node:fs/promises");
const ids = __IDS__;
const task = await taskSpace("question miner");
const page = task.page("p1");
const out = {};
for (const id of ids) {
  try {
    await page.goto("https://www.youtube.com/watch?v=" + id);
    await page.waitForLoadState();
    await page.waitForTimeout(2500);
    for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 1200)); await page.waitForTimeout(1400); }
    await page.waitForSelector("ytd-comment-thread-renderer", { timeout: 15000 }).catch(() => {});
    out[id] = await page.evaluate(() => [...document.querySelectorAll("ytd-comment-thread-renderer")].slice(0, 40).map(n => ({
      text: n.querySelector("#content-text")?.innerText?.trim() || "",
      likes: n.querySelector("#vote-count-middle")?.innerText?.trim() || "",
    })));
  } catch (e) { out[id] = []; }
}
await fs.writeFile(__OUT__, JSON.stringify(out), "utf8");
await task.finish({ keep: [] });
"""


def fetch_comments_browser(video_ids: Iterable[str], timeout: int = 1800) -> Dict[str, List[Dict[str, Any]]]:
    """API 한도가 찼을 때 ego-browser로 영상 페이지를 열어 상위 댓글을 읽는다."""
    exe = shutil.which("ego-browser")
    if not exe:
        raise YouTubeApiError("ego-browser를 찾지 못했습니다. ego lite가 설치되어 있는지 확인해 주세요.")
    ids = list(dict.fromkeys(video_ids))
    with tempfile.TemporaryDirectory() as tmp:
        out_path = Path(tmp, "comments.json").as_posix()
        script = _BROWSER_SCRIPT.replace("__IDS__", json.dumps(ids)).replace("__OUT__", json.dumps(out_path))
        subprocess.run([exe, "nodejs"], input=script.encode("utf-8"), check=True, timeout=timeout)
        raw = json.loads(Path(out_path).read_text(encoding="utf-8"))
    return {vid: [{"text": c["text"], "likes": parse_likes(c["likes"])} for c in raw.get(vid, [])] for vid in ids}


def mine_questions(
    videos: List[Dict[str, Any]],
    fetch: Callable[[str], List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """영상마다 댓글을 가져와 질문형만 남기고, 좋아요 순으로 정렬한다.

    한 영상이 목록을 독차지하지 않도록 영상당 좋아요 상위 MAX_PER_VIDEO개만 남긴다.
    """
    rows: List[Dict[str, Any]] = []
    for video in videos:
        questions = [c for c in fetch(video["video_id"]) if is_question(c["text"])]
        questions.sort(key=lambda c: c["likes"], reverse=True)
        for comment in questions[:MAX_PER_VIDEO]:
            rows.append({
                "question": " ".join(comment["text"].split()),
                "likes": comment["likes"],
                "keyword": video.get("keyword", ""),
                "video_title": video.get("title", ""),
                "video_views": video.get("view_count", 0),
                "video_url": f"https://www.youtube.com/watch?v={video['video_id']}",
            })
    rows.sort(key=lambda r: r["likes"], reverse=True)
    return rows
