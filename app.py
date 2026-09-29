from __future__ import annotations

import io

import pandas as pd
import streamlit as st

from ui import (
    SERIES_COLORS,
    STYLE,
    APP_NAME,
    format_korean_number,
    render_channel_headers,
    render_grid,
    render_metric,
    render_top_list,
    render_topbar,
    timing_chart,
)
from yt_finder.channels import (
    HOUR_BUCKETS,
    WEEKDAYS,
    analyze_channel,
    filter_kind,
    summarize,
    timing_breakdown,
    top_videos,
)
from yt_finder.config import FinderConfig, get_api_keys, get_shared_api_keys
from yt_finder.youtube_api import is_exhausted
from yt_finder.finder import collect_videos, sort_results
from yt_finder.youtube_api import YouTubeApiError

PERIOD_OPTIONS = {"7일": 7, "30일": 30, "90일": 90, "1년": 365, "전체": None}
SHORTS_OPTIONS = {"전체": "all", "롱폼": "long", "숏폼": "shorts"}
PRIORITY_OPTIONS = {"떡상 비율": "ratio", "조회수": "views", "구독자수": "subscribers", "최신 업로드": "latest"}
PRIORITY_HELP = {
    "ratio": "후보를 최대 250개까지 모두 살펴본 뒤 구독자 대비 조회수가 높은 순으로 골라요.",
    "views": "유튜브 조회수 순 검색 결과부터 채워요. 많이 본 영상 위주로 찾아요.",
    "subscribers": "관련도 순 후보를 최대 250개까지 모두 살펴본 뒤 구독자가 많은 채널부터 골라요.",
    "latest": "유튜브 최신순 검색 결과부터 채워요. 방금 뜨기 시작한 영상 위주로 찾아요.",
}
DAILY_QUOTA = 10000

st.set_page_config(page_title=APP_NAME, page_icon="🔎", layout="wide")
st.markdown(STYLE, unsafe_allow_html=True)
st.session_state.setdefault("quota_used", 0)
st.session_state.setdefault("personal_key", "")


def active_keys() -> list[str]:
    return get_api_keys(st.session_state.personal_key)


brand_col, key_col = st.columns([6, 1], vertical_alignment="center")
with brand_col:
    st.markdown(render_topbar("시딩할 한국 유튜브 크리에이터를 키워드로 찾고, 공개 연락처까지 한 번에 확인하세요."), unsafe_allow_html=True)
with key_col:
    shared = get_shared_api_keys()
    has_personal = bool(st.session_state.personal_key.strip())
    with st.popover("API 키 · 내 키 사용 중" if has_personal else "API 키", width="stretch"):
        remaining = sum(1 for k in shared if not is_exhausted(k))
        st.markdown(f"**공용 키** {len(shared)}개 등록 · 오늘 사용 가능 **{remaining}개**")
        st.caption("공용 키가 다 떨어지면 다음 키로 자동으로 넘어가요. 모두 떨어지면 아래에 개인 키를 넣어 주세요.")
        st.text_input(
            "내 YouTube API 키 (선택)", key="personal_key", type="password",
            placeholder="AIza…", help="입력하면 이 키를 가장 먼저 쓰고, 다 떨어지면 공용 키로 넘어가요. 이 브라우저 창에서만 쓰이고 저장되지 않아요.",
        )
        st.caption(
            "키 만들기: [Google Cloud Console](https://console.cloud.google.com) → 새 프로젝트 → "
            "YouTube Data API v3 사용 → 사용자 인증 정보 → API 키. "
            "**할당량은 프로젝트 단위**라 같은 프로젝트에서 만든 키끼리는 할당량을 나눠 써요."
        )


def quota_chip() -> str:
    return f"오늘 누적 약 {st.session_state.quota_used:,} / {DAILY_QUOTA:,}"


# ---------------------------------------------------------------- 영상 · 채널 찾기
def render_finder() -> None:
    with st.form("finder_form", border=False):
        search_col, button_col = st.columns([5, 1], vertical_alignment="bottom")
        with search_col:
            keyword = st.text_input("검색 키워드", placeholder="예: 캠핑 요리, 자취 레시피, 아이폰 리뷰")
        with button_col:
            submitted = st.form_submit_button("검색", type="primary")

        priority_col, kind_col, period_col = st.columns([4, 3, 4])
        with priority_col:
            priority_label = st.segmented_control(
                "우선순위", list(PRIORITY_OPTIONS), default="떡상 비율",
                help="우선순위에 따라 유튜브에서 후보를 가져오는 방식이 달라져서, 찾아지는 영상 자체가 달라져요.",
            )
        with kind_col:
            shorts_label = st.segmented_control("영상 종류", list(SHORTS_OPTIONS), default="전체")
        with period_col:
            period_label = st.segmented_control("업로드 기간", list(PERIOD_OPTIONS), default="30일")
        priority = PRIORITY_OPTIONS[priority_label or "떡상 비율"]
        st.markdown(
            '<div class="hint">우선순위에 따라 유튜브에서 가져오는 후보 자체가 달라져요. '
            "떡상 비율·구독자수는 후보를 끝까지 비교하고, 조회수·최신 업로드는 그 순서대로 채워요.</div>",
            unsafe_allow_html=True,
        )

        contact_only = st.toggle("공개 연락처(이메일·인스타그램 등)가 있는 채널만 찾기")

        with st.expander("상세 필터"):
            col1, col2, col3, col4, col5 = st.columns(5)
            with col1:
                ratio_percent = st.number_input("최소 비율 (%)", min_value=0, value=100, step=10)
            with col2:
                min_subscribers = st.number_input("최소 구독자수", min_value=0, value=1000, step=100)
            with col3:
                min_views = st.number_input("최소 조회수", min_value=0, value=10000, step=1000)
            with col4:
                max_per_channel = st.number_input("채널당 최대 영상", min_value=1, max_value=5, value=1, step=1)
            with col5:
                max_results = st.number_input("최대 결과 수", min_value=1, max_value=30, value=30, step=1)

    if submitted:
        if not keyword.strip():
            st.warning("검색 키워드를 입력해 주세요.")
            return

        config = FinderConfig(
            min_subscribers=int(min_subscribers),
            min_views=int(min_views),
            ratio_threshold=float(ratio_percent) / 100,
            max_results=int(max_results),
            published_within_days=PERIOD_OPTIONS[period_label or "30일"],
            shorts_mode=SHORTS_OPTIONS[shorts_label or "전체"],
            max_per_channel=int(max_per_channel),
            priority=priority,
            contact_only=contact_only,
        )
        with st.spinner("영상을 찾는 중입니다…"):
            try:
                outcome = collect_videos(keyword.strip(), config=config, api_keys=active_keys())
            except YouTubeApiError as exc:
                st.error(str(exc))
                return

        st.session_state.quota_used += outcome.quota_used
        st.session_state.outcome = outcome
        st.session_state.keyword = keyword.strip()
        st.session_state.requested = int(max_results)
        st.session_state.priority = priority
        st.session_state.result_sort = next(k for k, v in PRIORITY_OPTIONS.items() if v == priority)

    outcome = st.session_state.get("outcome")
    if outcome is None:
        return

    keyword = st.session_state.keyword
    with_contact = sum(1 for v in outcome.videos if v.get("has_contact"))
    chips = [f"{len(outcome.videos)}개 발견", f"연락처 공개 {with_contact}개"]
    if outcome.from_cache:
        chips.append("최근 검색 결과 재사용 · API 사용 0")
    else:
        chips.append(f"후보 {outcome.candidates_scanned}개 검사")
        chips.append(f"API {outcome.quota_used} units")
    chips.append(quota_chip())
    st.markdown(
        f'<div class="summary"><h2>‘{keyword}’ 결과</h2>'
        + "".join(f'<span class="chip">{c}</span>' for c in chips)
        + "</div>",
        unsafe_allow_html=True,
    )

    if not outcome.videos:
        st.markdown(
            '<div class="empty"><b>조건에 맞는 영상이 없어요</b>업로드 기간을 늘리거나 상세 필터의 최소 기준을 낮춰 보세요.</div>',
            unsafe_allow_html=True,
        )
        return

    st.caption(f"우선순위 · {PRIORITY_HELP[st.session_state.get('priority', 'ratio')]}")
    if len(outcome.videos) < st.session_state.requested:
        st.caption(f"조건에 맞는 영상이 {len(outcome.videos)}개뿐이에요. 기간을 늘리면 더 찾을 수 있어요.")

    sort_col, _, csv_col, xlsx_col = st.columns([4, 2, 1, 1], vertical_alignment="bottom")
    with sort_col:
        # 찾은 결과 안에서만 다시 정렬 (API 사용 없음). 기본값은 검색 때 고른 우선순위.
        sort_label = st.segmented_control("결과 정렬", list(PRIORITY_OPTIONS), key="result_sort", label_visibility="collapsed")
    videos = sort_results(outcome.videos, PRIORITY_OPTIONS.get(sort_label, st.session_state.get("priority", "ratio")))

    df = pd.DataFrame(videos)
    df.insert(0, "순위", range(1, len(df) + 1))
    df["종류"] = df["is_short"].map({True: "숏폼", False: "롱폼"})
    df["이메일"] = df.get("emails", pd.Series([[]] * len(df))).map(lambda xs: ", ".join(xs) if isinstance(xs, list) else "")
    links = df.get("contact_links", pd.Series([[]] * len(df)))
    df["인스타그램"] = links.map(lambda xs: ", ".join(l["url"] for l in xs if l["type"] == "instagram") if isinstance(xs, list) else "")
    df["기타 연락 링크"] = links.map(lambda xs: ", ".join(l["url"] for l in xs if l["type"] != "instagram") if isinstance(xs, list) else "")
    export_df = df[
        ["순위", "channel_name", "subscriber_count", "이메일", "인스타그램", "기타 연락 링크", "channel_url",
         "title", "view_count", "ratio_percent", "views_per_day", "uploaded_date", "종류", "video_url"]
    ].rename(
        columns={
            "title": "영상 제목", "channel_name": "채널", "view_count": "조회수", "subscriber_count": "구독자수",
            "ratio_percent": "구독자 대비(%)", "views_per_day": "일평균 조회수", "uploaded_date": "업로드일",
            "video_url": "영상 링크", "channel_url": "채널 링크",
        }
    )
    with csv_col:
        st.download_button(
            "CSV", data=export_df.to_csv(index=False).encode("utf-8-sig"),
            file_name=f"{keyword}_videos.csv", mime="text/csv", width="stretch",
        )
    with xlsx_col:
        buffer = io.BytesIO()
        export_df.to_excel(buffer, index=False, engine="openpyxl")
        st.download_button(
            "Excel", data=buffer.getvalue(), file_name=f"{keyword}_videos.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", width="stretch",
        )

    st.markdown(render_grid(videos), unsafe_allow_html=True)


# ---------------------------------------------------------------- 채널 비교
def render_compare() -> None:
    with st.form("compare_form", border=False):
        col1, col2, button_col = st.columns([5, 5, 2], vertical_alignment="bottom")
        with col1:
            first = st.text_input("채널 1", placeholder="https://www.youtube.com/@채널핸들")
        with col2:
            second = st.text_input("채널 2 (선택)", placeholder="비워 두면 채널 1만 분석해요")
        with button_col:
            submitted = st.form_submit_button("비교하기", type="primary")
        st.caption("채널 주소(@핸들, /channel/UC…), 핸들(@이름), 채널 이름 모두 입력할 수 있어요. 채널당 API 약 20 units (이름으로 찾으면 +100)를 씁니다.")

    if submitted:
        inputs = [text.strip() for text in (first, second) if text.strip()]
        if not inputs:
            st.warning("채널 주소를 1개 이상 입력해 주세요.")
            return
        reports, used = [], 0
        with st.spinner("채널 데이터를 모으는 중입니다…"):
            for text in inputs:
                try:
                    report, cost = analyze_channel(text, active_keys())
                except YouTubeApiError as exc:
                    st.error(str(exc))
                    return
                reports.append(report)
                used += cost
        st.session_state.quota_used += used
        st.session_state.compare = {"reports": reports, "quota": used}

    state = st.session_state.get("compare")
    if not state:
        st.markdown(
            '<div class="empty"><b>비교할 채널을 입력해 보세요</b>'
            "구독자수 · 평균 조회수 · 업로드 빈도 · 업로드 시간대별 성과 · 인기 영상 TOP 10을 나란히 보여 드려요.</div>",
            unsafe_allow_html=True,
        )
        return

    reports = state["reports"]
    names = [r["title"] for r in reports]
    if len(names) == 2 and names[0] == names[1]:
        names[1] += " (2)"

    chips = [f"채널 {len(reports)}개 분석", "최근 결과 재사용 · API 사용 0" if state["quota"] == 0 else f"API {state['quota']} units", quota_chip()]
    st.markdown(render_channel_headers(reports), unsafe_allow_html=True)
    st.markdown('<div class="summary">' + "".join(f'<span class="chip">{c}</span>' for c in chips) + "</div>", unsafe_allow_html=True)

    kind_label = st.segmented_control("분석 대상", list(SHORTS_OPTIONS), default="전체", key="compare_kind")
    kind = SHORTS_OPTIONS[kind_label or "전체"]
    recent = [filter_kind(r["videos"], kind) for r in reports]
    summaries = [summarize(v) for v in recent]

    # --- 핵심 지표 나란히 비교
    st.markdown('<div class="section-title">핵심 지표</div>'
                '<div class="section-sub">평균 조회수는 최근 영상 30개 기준 · 업로드 3일 이내 영상은 제외</div>',
                unsafe_allow_html=True)

    def entries(values):
        return [{"name": n, "color": c, "value": v} for n, c, v in zip(names, SERIES_COLORS, values)]

    metrics_html = "".join([
        render_metric("구독자수", "현재 기준 (API 반올림 값)", entries([r["subscriber_count"] for r in reports]),
                      lambda v: format_korean_number(int(v)) + "명"),
        render_metric("평균 조회수", "최근 영상 " + " / ".join(f"{s['sample_size']}개" for s in summaries),
                      entries([s["avg_views"] for s in summaries]), lambda v: format_korean_number(int(v)) + "회"),
        render_metric("업로드 빈도", "최근 90일 주당 평균 업로드 수", entries([s["uploads_per_week"] for s in summaries]),
                      lambda v: f"주 {v:.1f}개"),
    ])
    st.markdown(f'<div class="metrics">{metrics_html}</div>', unsafe_allow_html=True)

    # --- 시간대별 성과
    st.markdown('<div class="section-title">업로드 시간대별 성과</div>'
                f'<div class="section-sub">최근 업로드 {" / ".join(f"{len(v)}개" for v in recent)} · 한국 시간 기준 · '
                '막대에 마우스를 올리면 영상 수와 평균 조회수가 보여요</div>',
                unsafe_allow_html=True)
    by_col, metric_col = st.columns(2)
    with by_col:
        by_label = st.segmented_control("구분", ["시간대", "요일"], default="시간대", key="timing_by")
    with metric_col:
        metric_label = st.segmented_control("지표", ["채널 평균 대비", "평균 조회수"], default="채널 평균 대비", key="timing_metric")
    by = "weekday" if by_label == "요일" else "hour"
    metric = "avg_views" if metric_label == "평균 조회수" else "index"
    order = WEEKDAYS if by == "weekday" else HOUR_BUCKETS

    rows = []
    for name, videos in zip(names, recent):
        for row in timing_breakdown(videos, by="weekday" if by == "weekday" else "hour"):
            rows.append({"channel": name, **row})
    if rows:
        with st.container(border=True):
            st.altair_chart(timing_chart(rows, metric, order, names), width="stretch", theme=None)
            if metric == "index":
                st.caption("점선(100%)이 그 채널의 평균이에요. 막대가 점선보다 높으면 그 시간대에 올린 영상이 평소보다 잘 된 거예요. 영상 수가 적은 칸은 참고만 하세요.")
        with st.expander("표로 보기"):
            table = pd.DataFrame(rows).rename(columns={"channel": "채널", "bucket": "구분", "count": "영상 수", "avg_views": "평균 조회수", "index": "채널 평균 대비(%)"})
            table["평균 조회수"] = table["평균 조회수"].round(0).astype(int)
            table["채널 평균 대비(%)"] = table["채널 평균 대비(%)"].round(0).astype(int)
            st.dataframe(table, hide_index=True, width="stretch")
    else:
        st.info("분석할 영상이 부족해요.")

    # --- 인기 영상 TOP 10
    st.markdown('<div class="section-title">인기 영상 TOP 10</div>'
                f'<div class="section-sub">최근 업로드 {" / ".join(f"{len(v)}개" for v in recent)} 중 조회수 순 '
                '(API 한계로 채널 전체가 아닌 최근 최대 500개 영상에서 뽑아요)</div>', unsafe_allow_html=True)
    columns = st.columns(len(reports))
    for column, report, color, videos in zip(columns, reports, SERIES_COLORS, recent):
        with column:
            st.markdown(render_top_list(report, color, top_videos(videos)), unsafe_allow_html=True)


finder_tab, compare_tab = st.tabs(["크리에이터 찾기", "채널 비교"])
with finder_tab:
    render_finder()
with compare_tab:
    render_compare()
