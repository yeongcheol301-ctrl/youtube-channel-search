from __future__ import annotations

from html import escape
from typing import Any, Dict, Iterable, List

APP_NAME = "유튜브 채널 서치"

STYLE = """
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');

:root {
  --ink: #18181b;
  --ink-2: #52525b;
  --ink-3: #a1a1aa;
  --line: #e4e4e7;
  --line-soft: #f0f0f2;
  --surface: #ffffff;
  --canvas: #f4f4f5;
  --tint: #fafafa;
  --brand: #ff0033;
  --hot: #e5484d;
  --warm: #f76b15;
  --mild: #2a78d6;
  --shadow-sm: 0 1px 2px rgba(24,24,27,.04), 0 1px 1px rgba(24,24,27,.03);
  --shadow-lg: 0 16px 32px -12px rgba(24,24,27,.18), 0 2px 6px rgba(24,24,27,.05);
  --series-1: #2a78d6;
  --series-2: #eb6834;
}

html, body, [class*="css"], .stApp, .stMarkdown, button, input, textarea, select, label {
  font-family: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif !important;
  -webkit-font-smoothing: antialiased;
}
.stApp { background: var(--canvas); }
[data-testid="stHeader"] { background: transparent; }
#MainMenu, footer { visibility: hidden; }
.block-container { max-width: 1280px; padding-top: 2rem; padding-bottom: 4rem; }
a { text-decoration: none !important; }

/* ---------- 상단 브랜드 ---------- */
.topbar { display: flex; align-items: center; gap: 14px; margin: 0 0 22px; }
.logo {
  width: 44px; height: 44px; border-radius: 12px; background: var(--ink); flex: none;
  display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);
}
.logo svg { width: 22px; height: 22px; }
.topbar h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.035em; color: var(--ink); margin: 0; padding: 0; line-height: 1.2; }
.topbar p { font-size: 13.5px; color: var(--ink-2); margin: 2px 0 0; }

/* ---------- 탭 ---------- */
.stTabs [data-baseweb="tab-list"] { gap: 4px; border-bottom: 1px solid var(--line); }
.stTabs [data-baseweb="tab"] { font-size: 15px; font-weight: 700; padding: 10px 14px; color: var(--ink-3); }
.stTabs [aria-selected="true"] { color: var(--ink) !important; }
.stTabs [data-baseweb="tab-highlight"] { background: var(--ink) !important; height: 2px; }

/* ---------- 검색 패널 ---------- */
[data-testid="stForm"] {
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px;
  padding: 22px 24px 10px; box-shadow: var(--shadow-sm); margin-top: 6px;
}
[data-testid="stForm"] input { font-size: 15.5px; }
[data-testid="stForm"] label p { font-size: 13px !important; font-weight: 600; color: var(--ink-2); }
[data-testid="stFormSubmitButton"] button { height: 42px; border-radius: 10px; font-weight: 700; width: 100%; }
.hint { font-size: 12.5px; color: var(--ink-3); margin: -4px 0 8px; }

/* ---------- 결과 요약 ---------- */
.summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 30px 0 4px; align-items: center; }
.summary h2 { font-size: 21px; font-weight: 800; letter-spacing: -0.03em; color: var(--ink); margin: 0 8px 0 0; padding: 0; }
.chip { font-size: 12px; font-weight: 500; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); padding: 4px 10px; border-radius: 999px; }
.chip.dark { background: var(--ink); color: #fff; border-color: var(--ink); }

/* ---------- 영상 카드 ---------- */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 18px; margin-top: 10px; }
.card {
  display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line);
  border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-sm);
  transition: transform .18s ease, box-shadow .18s ease;
}
.card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.thumb { position: relative; display: block; aspect-ratio: 16 / 9; background: #e4e4e7; overflow: hidden; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
.card:hover .thumb img { transform: scale(1.03); }
.rank {
  position: absolute; top: 10px; left: 10px; min-width: 26px; height: 26px; padding: 0 8px; border-radius: 8px;
  background: rgba(24,24,27,.82); color: #fff; font-weight: 800; font-size: 12.5px;
  display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px);
}
.rank.top { background: var(--brand); }
.kind {
  position: absolute; top: 10px; right: 10px; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px;
  background: rgba(255,255,255,.94); color: var(--ink);
}
.kind.short { background: var(--ink); color: #fff; }
.dur {
  position: absolute; bottom: 8px; right: 8px; font-size: 11.5px; font-weight: 600; color: #fff;
  background: rgba(0,0,0,.75); padding: 2px 6px; border-radius: 5px; font-variant-numeric: tabular-nums;
}
.body { padding: 14px 16px 14px; display: flex; flex-direction: column; gap: 10px; flex: 1; }
.ch { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--ink-2) !important; }
.ch img { width: 24px; height: 24px; border-radius: 50%; background: #e4e4e7; flex: none; object-fit: cover; }
.ch span { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ch:hover span { color: var(--ink); text-decoration: underline; }
.title {
  font-size: 15px; font-weight: 700; line-height: 1.45; color: var(--ink) !important; letter-spacing: -0.015em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.9em;
}
.title:hover { text-decoration: underline; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--line-soft); }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat small { font-size: 11px; color: var(--ink-3); font-weight: 500; }
.stat strong { font-size: 14px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.stat strong.hot { color: var(--hot); }
.stat strong.warm { color: var(--warm); }
.stat strong.mild { color: var(--mild); }

/* 컨택 라인 */
.contact { background: var(--tint); border-top: 1px solid var(--line-soft); padding: 10px 16px 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.contact .lbl { font-size: 11px; font-weight: 700; color: var(--ink-3); letter-spacing: .04em; margin-right: 2px; }
.cbtn {
  display: inline-flex; align-items: center; gap: 5px; max-width: 100%; font-size: 12px; font-weight: 600;
  padding: 4px 9px; border-radius: 7px; background: var(--surface); border: 1px solid var(--line);
  color: var(--ink) !important; transition: border-color .15s ease, background .15s ease;
}
.cbtn:hover { border-color: var(--ink); }
.cbtn svg { width: 13px; height: 13px; flex: none; }
.cbtn span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cbtn.mail { background: var(--ink); border-color: var(--ink); color: #fff !important; }
.contact .none { font-size: 12px; color: var(--ink-3); }
.contact .none a { color: var(--ink-2) !important; text-decoration: underline !important; }

.empty {
  background: var(--surface); border: 1px dashed #d4d4d8; border-radius: 16px; padding: 44px 20px;
  text-align: center; color: var(--ink-2); margin-top: 22px; font-size: 14px;
}
.empty b { display: block; font-size: 17px; color: var(--ink); margin-bottom: 6px; }

/* ---------- 채널 비교 ---------- */
.section-title { font-size: 18px; font-weight: 800; letter-spacing: -0.03em; color: var(--ink); margin: 34px 0 2px; }
.section-sub { font-size: 12.5px; color: var(--ink-3); margin: 0 0 12px; }
.ch-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-top: 20px; }
.ch-card {
  display: flex; gap: 14px; align-items: center; background: var(--surface); border: 1px solid var(--line);
  border-radius: 14px; padding: 16px 18px; color: inherit !important; box-shadow: var(--shadow-sm);
  position: relative; overflow: hidden;
}
.ch-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); }
.ch-card img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: none; background: #e4e4e7; }
.ch-card .name { font-size: 17px; font-weight: 800; color: var(--ink); letter-spacing: -0.03em; }
.ch-card .handle { font-size: 12.5px; color: var(--ink-3); margin-top: 1px; }
.ch-card .meta { display: flex; gap: 14px; margin-top: 8px; font-size: 12.5px; color: var(--ink-2); flex-wrap: wrap; }
.ch-card .meta b { color: var(--ink); font-weight: 700; }

.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.metric { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px 18px; box-shadow: var(--shadow-sm); }
.metric h4 { font-size: 13px; font-weight: 700; color: var(--ink-2); margin: 0 0 2px; padding: 0; }
.metric .note { font-size: 11.5px; color: var(--ink-3); margin-bottom: 14px; }
.bar-row { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; margin-top: 12px; }
.bar-row .who { font-size: 12.5px; color: var(--ink-2); display: flex; align-items: center; gap: 6px; min-width: 0; }
.bar-row .who span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-row .dot { width: 8px; height: 8px; border-radius: 2px; background: var(--c); flex: none; }
.bar-row .val { font-size: 15px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; text-align: right; }
.bar-row .track { grid-column: 1 / -1; height: 10px; background: var(--line-soft); border-radius: 4px; overflow: hidden; }
.bar-row .fill { height: 100%; background: var(--c); border-radius: 0 4px 4px 0; min-width: 2px; }
.metric .lead { margin-top: 12px; font-size: 12px; color: var(--ink-2); }

.top-list { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; box-shadow: var(--shadow-sm); }
.top-list .head { padding: 14px 16px 12px; font-size: 15px; font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 8px; }
.top-list .head i { width: 10px; height: 10px; border-radius: 3px; background: var(--c); }
.top-item {
  display: grid; grid-template-columns: 22px 96px 1fr; gap: 12px; align-items: center; padding: 10px 16px;
  border-top: 1px solid var(--line-soft); color: inherit !important;
}
.top-item:hover { background: var(--tint); }
.top-item .n { font-size: 14px; font-weight: 800; color: var(--ink-3); text-align: center; }
.top-item img { width: 96px; aspect-ratio: 16/9; object-fit: cover; border-radius: 8px; background: #e4e4e7; }
.top-item .t { font-size: 13.5px; font-weight: 700; color: var(--ink); line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.top-item .s { font-size: 12px; color: var(--ink-3); margin-top: 3px; }
.tag { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; background: #efeff1; color: var(--ink-2); margin-right: 4px; }
.tag.short { background: var(--ink); color: #fff; }
</style>
"""

LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033"/><path d="M10 9.2v5.6l4.8-2.8L10 9.2z" fill="#fff"/></svg>'

ICONS = {
    "mail": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    "instagram": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    "kakao": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9L6.5 20l3.7-2.2c.6.1 1.2.2 1.8.2 5 0 9-3.1 9-7s-4-7-9-7z"/></svg>',
    "link": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
}


def render_topbar(subtitle: str) -> str:
    return (
        f'<div class="topbar"><div class="logo">{LOGO_SVG}</div>'
        f"<div><h1>{APP_NAME}</h1><p>{escape(subtitle)}</p></div></div>"
    )


def format_korean_number(value: int) -> str:
    if value >= 100_000_000:
        text = f"{value / 100_000_000:.1f}".rstrip("0").rstrip(".")
        return f"{text}억"
    if value >= 10_000:
        text = f"{value / 10_000:.1f}".rstrip("0").rstrip(".")
        return f"{text}만"
    return f"{value:,}"


def format_age(days: int) -> str:
    if days <= 1:
        return "오늘"
    if days < 30:
        return f"{days}일 전"
    if days < 365:
        return f"{days // 30}개월 전"
    return f"{days // 365}년 전"


def format_duration(seconds: int) -> str:
    if seconds <= 0:
        return ""
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"


def ratio_tier(percent: float) -> str:
    if percent >= 1000:
        return "hot"
    if percent >= 300:
        return "warm"
    return "mild"


def render_contact(row: Dict[str, Any]) -> str:
    buttons = []
    for email in row.get("emails", []):
        buttons.append(
            f'<a class="cbtn mail" href="mailto:{escape(email)}" title="{escape(email)}">{ICONS["mail"]}<span>{escape(email)}</span></a>'
        )
    for link in row.get("contact_links", []):
        icon = ICONS.get(link["type"], ICONS["link"])
        buttons.append(
            f'<a class="cbtn" href="{escape(link["url"])}" target="_blank" rel="noopener" title="{escape(link["url"])}">'
            f'{icon}<span>{escape(link["label"])}</span></a>'
        )
    if not buttons:
        about = f'{row.get("channel_url", "")}/about'
        buttons.append(
            f'<span class="none">공개 연락처 없음 · <a href="{escape(about)}" target="_blank" rel="noopener">채널 정보에서 확인</a></span>'
        )
    return f'<div class="contact"><span class="lbl">CONTACT</span>{"".join(buttons)}</div>'


def render_card(rank: int, row: Dict[str, Any]) -> str:
    percent = float(row.get("ratio_percent", 0))
    is_short = bool(row.get("is_short"))
    duration = format_duration(int(row.get("duration_seconds", 0)))
    video_url = escape(row.get("video_url", ""))
    parts = [
        '<div class="card">',
        f'<a class="thumb" href="{video_url}" target="_blank" rel="noopener">',
        f'<img src="{escape(row.get("thumbnail", ""))}" alt="" loading="lazy">',
        f'<span class="rank{" top" if rank <= 3 else ""}">{rank}</span>',
        f'<span class="kind{" short" if is_short else ""}">{"숏폼" if is_short else "롱폼"}</span>',
        f'<span class="dur">{duration}</span>' if duration else "",
        "</a>",
        '<div class="body">',
        f'<a class="ch" href="{escape(row.get("channel_url", ""))}" target="_blank" rel="noopener">'
        f'<img src="{escape(row.get("channel_thumbnail", ""))}" alt=""><span>{escape(row.get("channel_name", ""))}</span></a>',
        f'<a class="title" href="{video_url}" target="_blank" rel="noopener">{escape(row.get("title", ""))}</a>',
        '<div class="stats">',
        f'<div class="stat"><small>구독자</small><strong>{format_korean_number(int(row.get("subscriber_count", 0)))}</strong></div>',
        f'<div class="stat"><small>조회수</small><strong>{format_korean_number(int(row.get("view_count", 0)))}</strong></div>',
        f'<div class="stat"><small>구독자 대비</small><strong class="{ratio_tier(percent)}">{percent:,.0f}%</strong></div>',
        f'<div class="stat"><small>업로드</small><strong>{format_age(int(row.get("days_since_upload", 0)))}</strong></div>',
        "</div></div>",
        render_contact(row),
        "</div>",
    ]
    return "".join(parts)


def render_grid(rows: Iterable[Dict[str, Any]]) -> str:
    cards = "".join(render_card(index, row) for index, row in enumerate(rows, start=1))
    return f'<div class="grid">{cards}</div>'


# ---------- 채널 비교 ----------

SERIES_COLORS = ["#2a78d6", "#eb6834"]  # 채널 1, 채널 2 (색은 입력 순서를 따른다)


def render_channel_headers(reports: List[Dict[str, Any]]) -> str:
    cards = []
    for report, color in zip(reports, SERIES_COLORS):
        subs = "비공개" if report["subscribers_hidden"] else format_korean_number(report["subscriber_count"])
        cards.append(
            f'<a class="ch-card" style="--c:{color}" href="{escape(report["channel_url"])}" target="_blank" rel="noopener">'
            f'<img src="{escape(report["thumbnail"])}" alt="">'
            f'<div><div class="name">{escape(report["title"])}</div>'
            f'<div class="handle">{escape(report["handle"])}</div>'
            f'<div class="meta"><span>구독자 <b>{subs}</b></span>'
            f'<span>총 조회수 <b>{format_korean_number(report["total_views"])}</b></span>'
            f'<span>영상 <b>{report["video_count"]:,}개</b></span></div></div></a>'
        )
    return f'<div class="ch-row">{"".join(cards)}</div>'


def render_metric(title: str, note: str, entries: List[Dict[str, Any]], unit_format) -> str:
    """entries: [{name, color, value}] → 값 비례 막대 + 값 라벨."""
    peak = max((e["value"] for e in entries), default=0) or 1
    rows = []
    for e in entries:
        width = e["value"] / peak * 100
        rows.append(
            f'<div class="bar-row" style="--c:{e["color"]}" title="{escape(e["name"])}: {unit_format(e["value"])}">'
            f'<div class="who"><i class="dot"></i><span>{escape(e["name"])}</span></div>'
            f'<div class="val">{unit_format(e["value"])}</div>'
            f'<div class="track"><div class="fill" style="width:{width:.1f}%"></div></div></div>'
        )
    lead = ""
    if len(entries) == 2 and min(e["value"] for e in entries) > 0:
        hi, lo = sorted(entries, key=lambda e: -e["value"])
        lead = f'<div class="lead"><b>{escape(hi["name"])}</b>이(가) {hi["value"] / lo["value"]:.1f}배</div>'
    return f'<div class="metric"><h4>{title}</h4><div class="note">{note}</div>{"".join(rows)}{lead}</div>'


def render_top_list(report: Dict[str, Any], color: str, videos: List[Dict[str, Any]]) -> str:
    items = []
    for index, v in enumerate(videos, start=1):
        tag = '<span class="tag short">숏폼</span>' if v["is_short"] else '<span class="tag">롱폼</span>'
        date = v["published_at"][:10]
        items.append(
            f'<a class="top-item" href="{escape(v["video_url"])}" target="_blank" rel="noopener">'
            f'<div class="n">{index}</div><img src="{escape(v["thumbnail"])}" alt="" loading="lazy">'
            f'<div><div class="t">{escape(v["title"])}</div>'
            f'<div class="s">{tag}조회수 {format_korean_number(v["view_count"])} · {date}</div></div></a>'
        )
    if not items:
        items.append('<div class="top-item"><div></div><div></div><div class="s">해당 종류의 영상이 없어요</div></div>')
    return (
        f'<div class="top-list" style="--c:{color}"><div class="head"><i></i>{escape(report["title"])}</div>'
        f'{"".join(items)}</div>'
    )


def timing_chart(rows: List[Dict[str, Any]], metric: str, order: List[str], names: List[str]):
    """시간대/요일별 그룹 막대. rows: [{channel, bucket, count, avg_views, index}]"""
    import altair as alt
    import pandas as pd

    df = pd.DataFrame(rows)
    df["avg_label"] = df["avg_views"].map(lambda v: format_korean_number(int(v)))
    df["index_label"] = df["index"].map(lambda v: f"{v:.0f}%")
    axis_font = dict(labelFont="Pretendard Variable", titleFont="Pretendard Variable")

    bars = alt.Chart(df).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4).encode(
        x=alt.X("bucket:N", sort=order, title=None, scale=alt.Scale(paddingInner=0.3, paddingOuter=0.15),
                axis=alt.Axis(labelAngle=0, labelColor="#52525b", domainColor="#d4d4d8", ticks=False, **axis_font)),
        # 2px 틈: 같은 칸의 두 막대 사이
        xOffset=alt.XOffset("channel:N", sort=names, scale=alt.Scale(paddingInner=0.08)),
        y=alt.Y(f"{metric}:Q", title=None, axis=alt.Axis(
            gridColor="#ececef", domain=False, ticks=False, labelColor="#a1a1aa",
            labelExpr="datum.value >= 10000 ? format(datum.value / 10000, ',.0f') + '만' : format(datum.value, ',.0f')" if metric == "avg_views" else "datum.value + '%'",
            **axis_font,
        )),
        color=alt.Color("channel:N", sort=names, scale=alt.Scale(domain=names, range=SERIES_COLORS[: len(names)]),
                        legend=alt.Legend(title=None, orient="top", direction="horizontal", symbolType="square", labelFont="Pretendard Variable", labelFontSize=12)),
        tooltip=[
            alt.Tooltip("channel:N", title="채널"),
            alt.Tooltip("bucket:N", title="업로드 시각" if order and "시" in order[0] else "요일"),
            alt.Tooltip("count:Q", title="영상 수"),
            alt.Tooltip("avg_label:N", title="평균 조회수"),
            alt.Tooltip("index_label:N", title="채널 평균 대비"),
        ],
    )
    layers = [bars]
    if metric == "index":
        # 100% = 그 채널의 평균 성과
        layers.append(alt.Chart().mark_rule(color="#a1a1aa", strokeDash=[4, 3], strokeWidth=1).encode(y=alt.datum(100)))
    return (
        alt.layer(*layers)
        .properties(width="container", height=300, background="transparent", padding={"left": 4, "right": 4, "top": 8, "bottom": 4})
        .configure_view(strokeWidth=0)
        .configure_axis(labelFontSize=12, titleFontSize=11)
    )
