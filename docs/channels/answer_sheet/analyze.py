import re, sys, glob, os
import pandas as pd

ROOT = sys.argv[1]
SHEET = os.path.join(ROOT, "docs", "channels", "answer_sheet")

GROUPS = {
    "현실판정소": ["영화 현실 가능", "영화 장면 현실", "영화 고증", "영화 실제 사건", "영화 실험 해봤다",
              "영화처럼 하면 몸", "액션 영화 현실", "히어로 현실 계산", "만화 현실 가능", "재난 영화 현실", "자동차 사고 실험", "영화 실험", "영화 현실 몸", "히어로 현실"],
    "자본주의해부도": ["이유를 아시나요", "숨은 이유", "알고 보면", "건물 숨은 이유", "아파트 비밀", "건축 비밀",
                "돈 버는 구조", "가격의 비밀", "자영업 비밀", "부동산 숨은 이유", "세금 이유", "건물 이유"],
}

TYPES = {
    "실제 사례": r"실제|실화|사건|사고|해봤|실험|진짜로|사례|직접",
    "몸": r"몸|근육|뼈|부상|사망|죽|피가|심장|맞으면|떨어지면|버틸|생존|숨이|숨을|체온|고통|다치",
    "판타지 계산": r"히어로|만화|애니|마블|슈퍼|마법|원피스|주술|나루토|드래곤볼|계산|토르|아이언맨|스파이더",
    "확인형": r"가능할까|가능\?|가능한가|될까|일까\?|진짜일까|사실일까|현실에서|현실이라면|현실이면|VS",
    "통념 뒤집기": r"이유|비밀|알고 ?보면|사실은|숨은|아시나요|몰랐던|왜 |왜\?|진실|착각|오해",
    "돈 숫자": r"\d+ ?(원|만원|억|조|%)|돈|가격|수익|매출|월급|세금|비용|연봉|대출|부자",
}

rows = []
for group, kws in GROUPS.items():
    for kw in kws:
        path = os.path.join(SHEET, f"{kw}.csv")
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path, encoding="utf-8-sig")
        df["keyword"] = kw
        df["group"] = group
        rows.append(df)
data = pd.concat(rows, ignore_index=True)

# answer sheet with requested columns (keep every keyword row)
sheet = data[["group", "keyword", "title", "channel_name", "subscriber_count", "view_count",
              "ratio_percent", "uploaded_date", "video_url"]].copy()
sheet.columns = ["채널", "키워드", "제목", "채널명", "구독자", "조회수", "구독자대비%", "업로드일", "링크"]

# analysis on unique videos per group
uniq = data.drop_duplicates(subset=["group", "video_id"]).copy()
for t, pat in TYPES.items():
    uniq[t] = uniq["title"].astype(str).str.contains(pat, regex=True)

def tier(g):
    r = g["ratio"].rank(pct=True, method="average")
    g = g.copy()
    g["등급"] = "중간"
    g.loc[r > 0.8, "등급"] = "떡상"
    g.loc[r <= 0.5, "등급"] = "저조"
    return g

uniq = pd.concat([tier(g) for _, g in uniq.groupby("group")], ignore_index=True)

out = []
for group, g in uniq.groupby("group"):
    base_hit = (g["등급"] == "떡상").mean()
    base_low = (g["등급"] == "저조").mean()
    out.append(f"\n## {group}: 영상 {len(g)}편 (중복 제거), 떡상 기준 = 구독자 대비 {g['ratio_percent'].quantile(0.8):.0f}% 이상, 저조 = {g['ratio_percent'].median():.0f}% 이하")
    out.append(f"| 유형 | 편수 | 떡상 비율 | 저조 비율 |")
    out.append("|---|---|---|---|")
    out.append(f"| (전체) | {len(g)} | {base_hit:.0%} | {base_low:.0%} |")
    for t in TYPES:
        s = g[g[t]]
        if len(s) == 0:
            out.append(f"| {t} | 0 | - | - |")
            continue
        out.append(f"| {t} | {len(s)} | {(s['등급']=='떡상').mean():.0%} | {(s['등급']=='저조').mean():.0%} |")
    none = g[~g[list(TYPES)].any(axis=1)]
    out.append(f"| 해당 없음 | {len(none)} | {(none['등급']=='떡상').mean():.0%} | {(none['등급']=='저조').mean():.0%} |" if len(none) else "| 해당 없음 | 0 | - | - |")
    out.append("\n키워드별 편수 / 떡상 비율:")
    kw = data[data.group == group].drop_duplicates("video_id").merge(g[["video_id", "등급"]], on="video_id")
    for k, s in kw.groupby("keyword", sort=False):
        out.append(f"- {k}: {len(s)}편, 떡상 {(s['등급']=='떡상').mean():.0%}")
    out.append("\n떡상 상위 8편:")
    for _, r in g.sort_values("ratio", ascending=False).head(8).iterrows():
        tags = ",".join(t for t in TYPES if r[t]) or "-"
        out.append(f"- {r['title']} | {r['channel_name']} | 조회 {r['view_count']:,} / 구독 {r['subscriber_count']:,} ({r['ratio_percent']:.0f}%) | {tags}")

print("\n".join(out))
labels = uniq[["group", "video_id", "등급"] + list(TYPES)]
sheet = sheet.join(data[["video_id", "group"]]).merge(labels, on=["group", "video_id"], how="left").drop(columns=["video_id", "group"])
sheet.to_csv(os.path.join(SHEET, "00_답안지_전체.csv"), index=False, encoding="utf-8-sig")
print("\nsaved", len(sheet), "rows")
