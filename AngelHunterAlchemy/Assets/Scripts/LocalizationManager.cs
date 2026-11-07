using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// 4개 국어(KR / EN / JP / TW) 텍스트 관리자.
/// 게임 안의 모든 문장은 LocalizationManager.GetText("KEY") 로만 가져온다.
/// 새 문장을 추가하려면 아래 Table 에 { "KEY", new[] { 한국어, 영어, 일본어, 대만어(번체) } } 한 줄만 추가하면 된다.
/// </summary>
public static class LocalizationManager
{
    public enum Language { KR = 0, EN = 1, JP = 2, TW = 3 }

    const string PrefKey = "AHA_LANGUAGE";

    /// <summary>언어가 바뀌는 순간 호출된다. UI는 여기에 구독해서 글자를 새로 칠한다.</summary>
    public static event Action OnLanguageChanged;

    static bool initialized;
    static Language current = Language.KR;

    public static Language CurrentLanguage
    {
        get { EnsureInit(); return current; }
    }

    public static void SetLanguage(Language lang)
    {
        EnsureInit();
        current = lang;
        PlayerPrefs.SetInt(PrefKey, (int)lang);
        PlayerPrefs.Save();
        if (OnLanguageChanged != null) OnLanguageChanged();
    }

    public static string GetText(string key)
    {
        EnsureInit();
        string[] row;
        if (!Table.TryGetValue(key, out row)) return "#" + key;
        int idx = (int)current;
        if (idx < row.Length && !string.IsNullOrEmpty(row[idx])) return row[idx];
        return row[0]; // 번역이 비어 있으면 한국어로 대체
    }

    public static string GetText(string key, params object[] args)
    {
        string format = GetText(key);
        try { return string.Format(format, args); }
        catch (FormatException) { return format; }
    }

    static void EnsureInit()
    {
        if (initialized) return;
        initialized = true;
        if (PlayerPrefs.HasKey(PrefKey))
        {
            current = (Language)Mathf.Clamp(PlayerPrefs.GetInt(PrefKey), 0, 3);
        }
        else
        {
            switch (Application.systemLanguage)
            {
                case SystemLanguage.Korean: current = Language.KR; break;
                case SystemLanguage.Japanese: current = Language.JP; break;
                case SystemLanguage.ChineseTraditional:
                case SystemLanguage.Chinese: current = Language.TW; break;
                case SystemLanguage.English: current = Language.EN; break;
                default: current = Language.KR; break;
            }
        }
    }

    // ───────────────────────────── 텍스트 표 ─────────────────────────────
    //                          KR                                   EN                                        JP                                    TW
    static readonly Dictionary<string, string[]> Table = new Dictionary<string, string[]>
    {
        { "TITLE", new[] {
            "뒷골목 연금술사 - 천사 사냥꾼",
            "Back-Alley Alchemist: Angel Hunter",
            "路地裏の錬金術師 ～天使ハンター～",
            "暗巷鍊金術師 - 天使獵人" } },

        { "GOLD", new[] {
            "골드: {0}",
            "Gold: {0}",
            "ゴールド: {0}",
            "金幣: {0}" } },

        { "STATE_BREW", new[] {
            "가마솥 연성 중... ({0}/{1})",
            "Brewing in the cauldron... ({0}/{1})",
            "釜で錬成中…({0}/{1})",
            "大鍋鍊成中…({0}/{1})" } },

        { "STATE_REFINE", new[] {
            "{0}강 → {1}강 정제 중... ({2}/{3})",
            "Refining +{0} → +{1}... ({2}/{3})",
            "{0}強 → {1}強 精製中…({2}/{3})",
            "{0}強 → {1}強 精煉中…({2}/{3})" } },

        { "HINT_TAP", new[] {
            "타이밍에 맞춰 화면을 터치! (스페이스바)",
            "Tap the screen at the right moment! (Space)",
            "タイミングよく画面をタップ!(スペース)",
            "抓準時機點擊畫面!(空白鍵)" } },

        { "HINT_REFINE", new[] {
            "빗맞추면 폭발! 신중하게 터치!",
            "Miss once and it explodes! Tap carefully!",
            "外したら爆発!慎重にタップ!",
            "失手就爆炸!謹慎點擊!" } },

        { "HIT_SUCCESS", new[] { "성공!", "Success!", "成功!", "成功!" } },
        { "HIT_CRITICAL", new[] { "대성공!!", "CRITICAL!!", "大成功!!", "大成功!!" } },
        { "HIT_MISS", new[] {
            "실패... 처음부터!",
            "Miss... start over!",
            "失敗…最初から!",
            "失敗…從頭再來!" } },

        { "ITEM_NONE", new[] { "빈 가마솥", "Empty Cauldron", "空っぽの釜", "空空的大鍋" } },

        { "ITEM_FORMAT", new[] {
            "[{0}강] {1}",
            "[+{0}] {1}",
            "[{0}強] {1}",
            "[{0}強] {1}" } },

        { "ITEM_VALUE", new[] {
            "현재 가치: {0} 골드",
            "Value: {0} Gold",
            "現在の価値: {0} ゴールド",
            "目前價值: {0} 金幣" } },

        { "ITEM_COMPLETE", new[] {
            "금기 연성물 완성!",
            "Forbidden Brew Complete!",
            "禁忌の錬成物、完成!",
            "禁忌鍊成物 完成!" } },

        { "CRIT_BONUS", new[] {
            "대성공 보너스 x{0}",
            "Critical Bonus x{0}",
            "大成功ボーナス x{0}",
            "大成功獎勵 x{0}" } },

        { "CHOICE_TITLE", new[] {
            "팔까? 한 번 더 걸어볼까?",
            "Sell it, or risk it all?",
            "売る?それとも賭ける?",
            "要賣掉?還是再賭一把?" } },

        { "BTN_SELL", new[] {
            "지금 암시장에 팔기\n(+{0} 골드 확정)",
            "Sell on the Black Market Now\n(+{0} Gold guaranteed)",
            "今すぐ闇市で売る\n(+{0} ゴールド確定)",
            "立刻賣到黑市\n(確定 +{0} 金幣)" } },

        { "BTN_REFINE", new[] {
            "한 번 더 정제하기\n(성공 시 3배 {0}골드 / 실패 시 폭발 0원)",
            "Refine Once More\n(Success: x3 = {0} Gold / Fail: BOOM, 0)",
            "もう一度精製する\n(成功で3倍 {0}G / 失敗で爆発 0)",
            "再精煉一次\n(成功3倍 {0}金幣 / 失敗爆炸歸零)" } },

        { "DANGER_TITLE", new[] { "!! 경고 !!", "!! WARNING !!", "!! 警告 !!", "!! 警告 !!" } },

        { "DANGER_MSG", new[] {
            "천사 순찰대에게 마력 폭발이\n감지되기 직전입니다!",
            "The Angel Patrol is about to\ndetect your magic explosion!",
            "天使パトロール隊に魔力爆発が\n感知される寸前です!",
            "天使巡邏隊即將\n偵測到魔力爆炸!" } },

        { "DANGER_ITEM", new[] {
            "위험한 연성물: {0}\n({1} 골드)",
            "Item at risk: {0}\n({1} Gold)",
            "危険な錬成物: {0}\n({1} ゴールド)",
            "危險的鍊成物: {0}\n({1} 金幣)" } },

        { "BTN_GIVEUP", new[] {
            "포기하고 잿더미 치우기 (0골드)",
            "Give up & sweep the ashes (0 Gold)",
            "諦めて灰を片付ける(0ゴールド)",
            "放棄並清理灰燼(0金幣)" } },

        { "BTN_AD", new[] {
            "▶ 광고 보고 은폐 마법 쓰기\n(연성물 100% 보존 + 이어하기)",
            "▶ Watch an Ad: Concealment Spell\n(Keep item 100% + Continue)",
            "▶ 広告を見て隠蔽魔法を使う\n(錬成物100%保存+続行)",
            "▶ 看廣告施放隱匿魔法\n(鍊成物100%保留+繼續)" } },

        { "TOAST_AD_DONE", new[] {
            "광고 시청 완료! 은폐 마법 발동!",
            "Ad watched! Concealment spell cast!",
            "広告視聴完了!隠蔽魔法発動!",
            "廣告觀看完畢!隱匿魔法發動!" } },

        { "TOAST_SOLD", new[] {
            "암시장 판매 완료! +{0} 골드",
            "Sold on the black market! +{0} Gold",
            "闇市で売却!+{0} ゴールド",
            "黑市售出!+{0} 金幣" } },

        { "TOAST_EXPLODED", new[] {
            "펑! 연성물이 잿더미가 되었습니다...",
            "BOOM! Your brew turned to ashes...",
            "ドカン!錬成物が灰になった…",
            "砰!鍊成物化為灰燼…" } },

        // ─── 강화 단계별 금기 연성물 이름 (10강 이후는 ITEM_10 사용) ───
        { "ITEM_1",  new[] { "천사 눈뽕용 섬광탄",   "Angel-Blinding Flashbang",        "天使目くらまし閃光弾",   "天使致盲閃光彈" } },
        { "ITEM_2",  new[] { "날개 접착 끈끈이 폭탄", "Wing-Gluing Sticky Bomb",         "翼くっつけ粘着爆弾",     "翅膀黏黏炸彈" } },
        { "ITEM_3",  new[] { "후광 소등 연막탄",     "Halo-Dimming Smoke Bomb",         "光輪消灯スモーク弾",     "光環熄燈煙霧彈" } },
        { "ITEM_4",  new[] { "깃털 뽑기 회오리 물약", "Feather-Plucking Tornado Potion", "羽むしり竜巻ポーション", "拔羽旋風藥水" } },
        { "ITEM_5",  new[] { "성가대 음치 저주약",   "Choir Off-Key Curse Potion",      "聖歌隊音痴の呪い薬",     "聖歌隊走音詛咒藥" } },
        { "ITEM_6",  new[] { "천국행 티켓 위조 잉크", "Heaven Ticket Forgery Ink",       "天国行き切符偽造インク", "天堂車票偽造墨水" } },
        { "ITEM_7",  new[] { "대천사 숙취 유발 와인", "Archangel Hangover Wine",         "大天使二日酔いワイン",   "大天使宿醉葡萄酒" } },
        { "ITEM_8",  new[] { "구름 증발 산성비",     "Cloud-Melting Acid Rain",         "雲蒸発の酸性雨",         "雲朵蒸發酸雨" } },
        { "ITEM_9",  new[] { "천계 통신 교란 종",    "Celestial Signal-Jamming Bell",   "天界通信妨害の鐘",       "天界通訊干擾鐘" } },
        { "ITEM_10", new[] { "신의 눈꺼풀 무게추",   "Weights for God's Eyelids",       "神のまぶたの重り",       "神之眼皮秤錘" } },
    };
}
