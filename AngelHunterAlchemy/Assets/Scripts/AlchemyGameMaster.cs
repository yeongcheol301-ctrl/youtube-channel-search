using System.Collections;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
#endif

/// <summary>
/// [1단계 프로토타입] 가마솥 타이밍 연성 & 하이리스크 강화 (Stop or Go)
///
/// ● 이 스크립트 하나가 Canvas, 버튼, 게이지 바, 텍스트, 카메라, EventSystem 을 전부 코드로 만든다.
/// ● 인스펙터에서 연결할 것은 없다. 빈 게임오브젝트에 넣거나, 아예 안 넣어도
///   Play 를 누르면 자동으로 생성된다(아래 AutoBootstrap).
/// ● 모든 문장은 LocalizationManager.GetText("KEY") 로 가져온다.
/// ● 골드는 PlayerPrefs 에 저장된다(서버 없음).
/// </summary>
public class AlchemyGameMaster : MonoBehaviour
{
    public static AlchemyGameMaster Instance { get; private set; }

    // ───────────── 밸런스 값 (숫자만 바꿔서 손맛 조절) ─────────────
    const int HitsPerStage = 3;          // 몇 번 연속 성공해야 1단계 완성인지
    const long BaseValue = 100;          // 1강 연성물 기본 가치
    const long RefineMultiplier = 3;     // 정제 성공 시 가치 배수
    const float CritBonusPerHit = 0.25f; // 대성공 1회당 추가 보너스(+25%)

    float PointerSpeed { get { return Mathf.Min(4.5f, 0.9f + 0.4f * level); } }      // 초당 게이지 왕복 거리(1 = 게이지 전체 폭)
    float SuccessWidth { get { return Mathf.Max(0.10f, 0.42f - 0.06f * level); } }   // 노란 구간 폭(0~1)
    float CritWidth { get { return Mathf.Max(0.025f, 0.09f - 0.012f * level); } }    // 보라 구간 폭(0~1)

    // ───────────── 화면 크기 기준 ─────────────
    const float RefW = 1080f, RefH = 1920f;
    const float GaugeW = 900f, GaugeH = 90f;
    const string GoldPrefKey = "AHA_GOLD";

    enum State { Brewing, Busy, Choice, Danger }

    // ───────────── 게임 상태 ─────────────
    State state = State.Brewing;
    int level;            // 현재 연성물의 강화 수치(0 = 아직 없음)
    int hits;             // 이번 단계에서 연속 성공한 횟수
    int critsThisStage;   // 이번 단계에서 대성공한 횟수
    long itemValue;       // 현재 연성물 가치
    long gold;            // 보유 골드
    float pointerPos;     // 0(왼쪽) ~ 1(오른쪽)
    float pointerDir = 1f;

    // ───────────── 자동 생성 UI 참조 ─────────────
    Font font;
    RectTransform shakeRoot;
    Text titleText, goldText, statusText, itemNameText, itemValueText, feedbackText, hintText, toastText;
    Image toastBg;
    RectTransform cauldronRoot;
    Image cauldronGlow, cauldronLiquid;
    RectTransform successZone, critZone, pointer;
    GameObject choicePanel;
    Text choiceTitleText, sellLabel, refineLabel;
    GameObject dangerPanel;
    Text dangerTitleText, dangerMsgText, dangerItemText, giveUpLabel, adLabel;
    Image dangerFlash, hitFlash;
    Button[] langButtons = new Button[4];

    Coroutine shakeCo, cauldronPunchCo, feedbackCo, toastCo, hitFlashCo, dangerFlashCo;

    static readonly Color[] LevelColors =
    {
        new Color(0.45f, 0.38f, 0.32f), // 0: 탁한 재료
        new Color(0.30f, 0.85f, 0.35f), // 1: 초록
        new Color(0.20f, 0.85f, 0.95f), // 2: 청록
        new Color(0.25f, 0.45f, 1.00f), // 3: 파랑
        new Color(0.65f, 0.30f, 1.00f), // 4: 보라
        new Color(1.00f, 0.30f, 0.80f), // 5: 핑크
        new Color(1.00f, 0.55f, 0.15f), // 6: 주황
        new Color(1.00f, 0.85f, 0.20f), // 7+: 황금 (8강부터는 무지개로 변함)
    };

    // Play 를 누르면 씬에 마스터가 없어도 자동으로 하나 만든다(완전 무설정).
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void AutoBootstrap()
    {
        if (Instance == null) new GameObject("AlchemyGameMaster").AddComponent<AlchemyGameMaster>();
    }

    // ═════════════════════════════ 생명주기 ═════════════════════════════
    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;

        Application.targetFrameRate = 60;
        Screen.orientation = ScreenOrientation.Portrait;

        gold = LoadGold();
        font = LoadFont();

        EnsureCamera();
        EnsureEventSystem();
        BuildUI();

        LocalizationManager.OnLanguageChanged += RefreshTexts;
        ResetToNewBrew();
    }

    void OnDestroy()
    {
        if (Instance == this)
        {
            LocalizationManager.OnLanguageChanged -= RefreshTexts;
            Instance = null;
        }
    }

    void Update()
    {
        if (Instance != this || pointer == null) return;

        // 버튼이 "선택됨" 상태로 남아 스페이스바에 눌리는 것을 방지
        if (EventSystem.current != null && EventSystem.current.currentSelectedGameObject != null)
            EventSystem.current.SetSelectedGameObject(null);

        if (state == State.Brewing)
        {
            pointerPos += pointerDir * PointerSpeed * Time.deltaTime;
            if (pointerPos >= 1f) { pointerPos = 1f; pointerDir = -1f; }
            else if (pointerPos <= 0f) { pointerPos = 0f; pointerDir = 1f; }
            pointer.anchoredPosition = new Vector2((pointerPos - 0.5f) * GaugeW, 0f);
        }

        if (SpacePressed()) OnTap();

        UpdateCauldronColor();
    }

    // ═════════════════════════════ 게임 로직 ═════════════════════════════
    void OnTap()
    {
        if (state != State.Brewing) return;

        float d = Mathf.Abs(pointerPos - 0.5f);
        bool crit = d <= CritWidth * 0.5f;
        bool success = crit || d <= SuccessWidth * 0.5f;

        if (!success)
        {
            if (level == 0)
            {
                // 첫 연성 중 실패: 연속 기록만 초기화
                hits = 0;
                critsThisStage = 0;
                ShowFeedback(LocalizationManager.GetText("HIT_MISS"), new Color(0.8f, 0.8f, 0.8f));
                Shake(10f, 0.15f);
                RefreshTexts();
            }
            else
            {
                EnterDanger();
            }
            return;
        }

        hits++;
        if (crit) critsThisStage++;

        if (crit)
        {
            ShowFeedback(LocalizationManager.GetText("HIT_CRITICAL"), new Color(0.85f, 0.45f, 1f));
            Shake(34f, 0.25f);
            HitFlash(new Color(0.75f, 0.35f, 1f), 0.35f);
        }
        else
        {
            ShowFeedback(LocalizationManager.GetText("HIT_SUCCESS"), new Color(1f, 0.88f, 0.2f));
            Shake(16f, 0.15f);
            HitFlash(new Color(1f, 0.95f, 0.6f), 0.15f);
        }
        PunchCauldron(crit ? 0.22f : 0.12f);
        SpawnBubbles(crit ? 12 : 6);

        if (hits >= HitsPerStage) CompleteStage();
        RefreshTexts();
    }

    void CompleteStage()
    {
        float mult = 1f + CritBonusPerHit * critsThisStage;
        if (level == 0) itemValue = (long)Mathf.Round(BaseValue * mult);
        else itemValue = (long)System.Math.Round(itemValue * RefineMultiplier * (double)mult);
        level++;
        hits = 0;
        critsThisStage = 0;
        state = State.Busy;
        StartCoroutine(CompleteRoutine(mult));
    }

    IEnumerator CompleteRoutine(float mult)
    {
        RefreshTexts();
        yield return new WaitForSeconds(0.25f);
        string msg = LocalizationManager.GetText("ITEM_COMPLETE");
        if (mult > 1f) msg += "\n" + LocalizationManager.GetText("CRIT_BONUS", mult.ToString("0.##"));
        ShowFeedback(msg, Color.white, 1.0f);
        PunchCauldron(0.35f);
        SpawnBubbles(20);
        Shake(24f, 0.3f);
        HitFlash(Color.white, 0.4f);
        yield return new WaitForSeconds(0.8f);
        state = State.Choice;
        choicePanel.SetActive(true);
        RefreshTexts();
    }

    void OnSell()
    {
        if (state != State.Choice) return;
        long earned = itemValue;
        gold += earned;
        SaveGold();
        ShowToast(LocalizationManager.GetText("TOAST_SOLD", earned.ToString("N0")), new Color(1f, 0.85f, 0.2f));
        ResetToNewBrew();
    }

    void OnRefine()
    {
        if (state != State.Choice) return;
        choicePanel.SetActive(false);
        hits = 0;
        critsThisStage = 0;
        pointerPos = 0f;
        pointerDir = 1f;
        ApplyGaugeZones();
        state = State.Brewing;
        RefreshTexts();
    }

    void EnterDanger()
    {
        state = State.Danger;
        dangerPanel.SetActive(true);
        Shake(45f, 0.45f);
        if (dangerFlashCo != null) StopCoroutine(dangerFlashCo);
        dangerFlashCo = StartCoroutine(DangerFlashRoutine());
        RefreshTexts();
    }

    void OnGiveUp()
    {
        if (state != State.Danger) return;
        dangerPanel.SetActive(false);
        ShowToast(LocalizationManager.GetText("TOAST_EXPLODED"), new Color(1f, 0.4f, 0.35f));
        Shake(40f, 0.4f);
        ResetToNewBrew();
    }

    void OnWatchAd()
    {
        if (state != State.Danger) return;
        // TODO: 실제 보상형 광고 SDK 연결 위치. 지금은 테스트용으로 즉시 성공 처리.
        state = State.Busy;
        dangerPanel.SetActive(false);
        ShowToast(LocalizationManager.GetText("TOAST_AD_DONE"), new Color(0.4f, 1f, 0.6f));
        StartCoroutine(ReviveRoutine());
    }

    IEnumerator ReviveRoutine()
    {
        HitFlash(new Color(0.4f, 1f, 0.6f), 0.35f);
        yield return new WaitForSeconds(0.9f);
        // 연성물·진행 횟수 100% 보존한 채 이어하기
        pointerPos = 0f;
        pointerDir = 1f;
        state = State.Brewing;
        RefreshTexts();
    }

    void ResetToNewBrew()
    {
        level = 0;
        itemValue = 0;
        hits = 0;
        critsThisStage = 0;
        pointerPos = 0f;
        pointerDir = 1f;
        if (choicePanel != null) choicePanel.SetActive(false);
        if (dangerPanel != null) dangerPanel.SetActive(false);
        ApplyGaugeZones();
        state = State.Brewing;
        RefreshTexts();
    }

    void ApplyGaugeZones()
    {
        successZone.sizeDelta = new Vector2(SuccessWidth * GaugeW, GaugeH);
        critZone.sizeDelta = new Vector2(CritWidth * GaugeW, GaugeH);
    }

    string ItemName(int lv)
    {
        string nameKey = "ITEM_" + Mathf.Clamp(lv, 1, 10);
        return LocalizationManager.GetText("ITEM_FORMAT", lv, LocalizationManager.GetText(nameKey));
    }

    // ═════════════════════════════ 텍스트 갱신 (언어 변경 포함) ═════════════════════════════
    void RefreshTexts()
    {
        if (titleText == null) return;

        titleText.text = LocalizationManager.GetText("TITLE");
        goldText.text = LocalizationManager.GetText("GOLD", gold.ToString("N0"));

        statusText.text = level == 0
            ? LocalizationManager.GetText("STATE_BREW", hits, HitsPerStage)
            : LocalizationManager.GetText("STATE_REFINE", level, level + 1, hits, HitsPerStage);

        if (state == State.Choice)
            statusText.text = LocalizationManager.GetText("ITEM_COMPLETE");

        itemNameText.text = level == 0 ? LocalizationManager.GetText("ITEM_NONE") : ItemName(level);
        itemValueText.text = level == 0 ? "" : LocalizationManager.GetText("ITEM_VALUE", itemValue.ToString("N0"));

        hintText.text = level == 0 ? LocalizationManager.GetText("HINT_TAP") : LocalizationManager.GetText("HINT_REFINE");
        hintText.color = level == 0 ? new Color(1f, 1f, 1f, 0.85f) : new Color(1f, 0.45f, 0.4f, 1f);
        hintText.gameObject.SetActive(state == State.Brewing);

        choiceTitleText.text = LocalizationManager.GetText("CHOICE_TITLE");
        sellLabel.text = LocalizationManager.GetText("BTN_SELL", itemValue.ToString("N0"));
        refineLabel.text = LocalizationManager.GetText("BTN_REFINE", (itemValue * RefineMultiplier).ToString("N0"));

        dangerTitleText.text = LocalizationManager.GetText("DANGER_TITLE");
        dangerMsgText.text = LocalizationManager.GetText("DANGER_MSG");
        dangerItemText.text = level == 0 ? "" : LocalizationManager.GetText("DANGER_ITEM", ItemName(level), itemValue.ToString("N0"));
        giveUpLabel.text = LocalizationManager.GetText("BTN_GIVEUP");
        adLabel.text = LocalizationManager.GetText("BTN_AD");

        int cur = (int)LocalizationManager.CurrentLanguage;
        for (int i = 0; i < langButtons.Length; i++)
        {
            if (langButtons[i] == null) continue;
            langButtons[i].GetComponent<Image>().color = i == cur ? new Color(1f, 0.8f, 0.2f) : new Color(0.25f, 0.22f, 0.3f);
        }
    }

    // ═════════════════════════════ 연출 (타격감) ═════════════════════════════
    void Shake(float magnitude, float duration)
    {
        if (shakeCo != null) StopCoroutine(shakeCo);
        shakeCo = StartCoroutine(ShakeRoutine(magnitude, duration));
    }

    IEnumerator ShakeRoutine(float magnitude, float duration)
    {
        float t = 0f;
        while (t < duration)
        {
            t += Time.deltaTime;
            float damper = 1f - Mathf.Clamp01(t / duration);
            shakeRoot.anchoredPosition = Random.insideUnitCircle * magnitude * damper;
            yield return null;
        }
        shakeRoot.anchoredPosition = Vector2.zero;
    }

    void PunchCauldron(float amount)
    {
        if (cauldronPunchCo != null) StopCoroutine(cauldronPunchCo);
        cauldronPunchCo = StartCoroutine(PunchRoutine(cauldronRoot, amount, 0.25f));
    }

    IEnumerator PunchRoutine(RectTransform target, float amount, float duration)
    {
        float t = 0f;
        while (t < duration)
        {
            t += Time.deltaTime;
            float k = Mathf.Sin(Mathf.Clamp01(t / duration) * Mathf.PI);
            target.localScale = new Vector3(1f + amount * k, 1f + amount * 0.6f * k, 1f);
            yield return null;
        }
        target.localScale = Vector3.one;
    }

    void ShowFeedback(string msg, Color color, float hold = 0.45f)
    {
        if (feedbackCo != null) StopCoroutine(feedbackCo);
        feedbackCo = StartCoroutine(FeedbackRoutine(msg, color, hold));
    }

    IEnumerator FeedbackRoutine(string msg, Color color, float hold)
    {
        feedbackText.text = msg;
        RectTransform rt = feedbackText.rectTransform;
        float t = 0f;
        while (t < 0.15f)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / 0.15f);
            rt.localScale = Vector3.one * Mathf.Lerp(1.7f, 1f, k);
            feedbackText.color = new Color(color.r, color.g, color.b, k);
            yield return null;
        }
        rt.localScale = Vector3.one;
        feedbackText.color = color;
        yield return new WaitForSeconds(hold);
        t = 0f;
        while (t < 0.3f)
        {
            t += Time.deltaTime;
            feedbackText.color = new Color(color.r, color.g, color.b, 1f - Mathf.Clamp01(t / 0.3f));
            yield return null;
        }
        feedbackText.color = new Color(color.r, color.g, color.b, 0f);
    }

    void ShowToast(string msg, Color color)
    {
        if (toastCo != null) StopCoroutine(toastCo);
        toastCo = StartCoroutine(ToastRoutine(msg, color));
    }

    IEnumerator ToastRoutine(string msg, Color color)
    {
        toastText.text = msg;
        toastBg.gameObject.SetActive(true);
        float t = 0f;
        const float total = 1.8f;
        while (t < total)
        {
            t += Time.deltaTime;
            float a = t < 0.15f ? t / 0.15f : (t > total - 0.4f ? (total - t) / 0.4f : 1f);
            toastText.color = new Color(color.r, color.g, color.b, a);
            toastBg.color = new Color(0f, 0f, 0f, 0.75f * a);
            yield return null;
        }
        toastBg.gameObject.SetActive(false);
    }

    void HitFlash(Color color, float alpha)
    {
        if (hitFlashCo != null) StopCoroutine(hitFlashCo);
        hitFlashCo = StartCoroutine(HitFlashRoutine(color, alpha));
    }

    IEnumerator HitFlashRoutine(Color color, float alpha)
    {
        float t = 0f;
        const float dur = 0.2f;
        while (t < dur)
        {
            t += Time.deltaTime;
            hitFlash.color = new Color(color.r, color.g, color.b, alpha * (1f - Mathf.Clamp01(t / dur)));
            yield return null;
        }
        hitFlash.color = new Color(color.r, color.g, color.b, 0f);
    }

    IEnumerator DangerFlashRoutine()
    {
        float t = 0f;
        while (state == State.Danger)
        {
            t += Time.deltaTime;
            float a = 0.15f + 0.30f * (0.5f + 0.5f * Mathf.Sin(t * 14f));
            dangerFlash.color = new Color(1f, 0f, 0f, a);
            yield return null;
        }
        dangerFlash.color = new Color(1f, 0f, 0f, 0f);
    }

    void SpawnBubbles(int count)
    {
        Color baseColor = CurrentLiquidColor();
        for (int i = 0; i < count; i++)
        {
            float size = Random.Range(18f, 46f);
            Image b = CreateImage(cauldronRoot, "Bubble",
                new Vector2(Random.Range(-170f, 170f), 290f), new Vector2(size, size),
                Color.Lerp(baseColor, Color.white, 0.4f), false);
            StartCoroutine(BubbleRoutine(b));
        }
    }

    IEnumerator BubbleRoutine(Image b)
    {
        RectTransform rt = b.rectTransform;
        Vector2 start = rt.anchoredPosition;
        float rise = Random.Range(140f, 320f);
        float drift = Random.Range(-60f, 60f);
        float dur = Random.Range(0.5f, 0.9f);
        Color c = b.color;
        float t = 0f;
        while (t < dur && b != null)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            rt.anchoredPosition = start + new Vector2(drift * k, rise * k);
            b.color = new Color(c.r, c.g, c.b, 1f - k);
            yield return null;
        }
        if (b != null) Destroy(b.gameObject);
    }

    Color CurrentLiquidColor()
    {
        Color baseColor;
        if (level >= 8)
            baseColor = Color.HSVToRGB(Mathf.Repeat(Time.time * 0.35f, 1f), 0.75f, 1f); // 8강 이상: 무지개
        else
            baseColor = LevelColors[Mathf.Min(level, LevelColors.Length - 1)];
        // 연속 성공할수록 더 밝게 끓어오름
        return Color.Lerp(baseColor, Color.white, 0.12f * hits);
    }

    void UpdateCauldronColor()
    {
        if (cauldronLiquid == null) return;
        Color c = CurrentLiquidColor();
        cauldronLiquid.color = c;
        float pulse = 0.25f + 0.1f * Mathf.Sin(Time.time * (3f + level)) + 0.05f * level;
        cauldronGlow.color = new Color(c.r, c.g, c.b, Mathf.Clamp01(pulse));
        cauldronGlow.rectTransform.localScale = Vector3.one * (1f + 0.04f * Mathf.Sin(Time.time * 4f));
    }

    // ═════════════════════════════ 입력 ═════════════════════════════
    static bool SpacePressed()
    {
#if ENABLE_INPUT_SYSTEM
        if (Keyboard.current != null && Keyboard.current.spaceKey.wasPressedThisFrame) return true;
#endif
#if ENABLE_LEGACY_INPUT_MANAGER
        if (Input.GetKeyDown(KeyCode.Space)) return true;
#endif
        return false;
    }

    // ═════════════════════════════ 저장 (PlayerPrefs) ═════════════════════════════
    static long LoadGold()
    {
        long v;
        return long.TryParse(PlayerPrefs.GetString(GoldPrefKey, "0"), out v) ? v : 0;
    }

    void SaveGold()
    {
        PlayerPrefs.SetString(GoldPrefKey, gold.ToString());
        PlayerPrefs.Save();
    }

    // ═════════════════════════════ 씬 기본 요소 자동 생성 ═════════════════════════════
    void EnsureCamera()
    {
        Camera cam = Camera.main;
        if (cam == null)
        {
            GameObject go = new GameObject("Main Camera");
            go.tag = "MainCamera";
            cam = go.AddComponent<Camera>();
            cam.orthographic = true;
            go.transform.position = new Vector3(0f, 0f, -10f);
        }
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.07f, 0.05f, 0.09f);
    }

    void EnsureEventSystem()
    {
        if (EventSystem.current != null) return;
        GameObject go = new GameObject("EventSystem");
        go.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
        go.AddComponent<InputSystemUIInputModule>();
#else
        go.AddComponent<StandaloneInputModule>();
#endif
    }

    static Font LoadFont()
    {
        Font f = null;
        // 한글·일본어·번체 글자가 깨지지 않도록 운영체제의 CJK 폰트를 우선 사용
        try
        {
            f = Font.CreateDynamicFontFromOSFont(new[]
            {
                "Malgun Gothic", "Apple SD Gothic Neo", "AppleGothic", "Noto Sans CJK KR",
                "Microsoft JhengHei", "Meiryo", "Hiragino Sans", "Arial Unicode MS", "Arial"
            }, 48);
        }
        catch (System.Exception) { f = null; }
        if (f == null) { try { f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch (System.Exception) { f = null; } }
        if (f == null) { try { f = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch (System.Exception) { f = null; } }
        return f;
    }

    // ═════════════════════════════ UI 자동 생성 ═════════════════════════════
    void BuildUI()
    {
        // Canvas (9:16, 1080x1920 기준으로 자동 확대/축소)
        GameObject canvasGo = new GameObject("GameCanvas");
        canvasGo.transform.SetParent(transform, false);
        Canvas canvas = canvasGo.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 10;
        CanvasScaler scaler = canvasGo.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(RefW, RefH);
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        scaler.matchWidthOrHeight = 0.5f;
        canvasGo.AddComponent<GraphicRaycaster>();
        RectTransform root = canvasGo.GetComponent<RectTransform>();

        // 배경
        Image bg = CreateImage(root, "Background", Vector2.zero, Vector2.zero, new Color(0.09f, 0.06f, 0.12f), false);
        Stretch(bg.rectTransform);

        // 화면 전체 터치 영역 (버튼이 없는 곳을 누르면 판정)
        Image tapImg = CreateImage(root, "TapArea", Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0f), true);
        Stretch(tapImg.rectTransform);
        tapImg.gameObject.AddComponent<TapArea>().OnTap = OnTap;

        // 흔들림 연출용 루트 (가마솥·게이지·텍스트가 함께 흔들림)
        shakeRoot = CreateRect(root, "ShakeRoot");
        Stretch(shakeRoot);

        titleText = CreateText(shakeRoot, "Title", new Vector2(0f, 800f), new Vector2(1000f, 80f), 50, new Color(0.95f, 0.85f, 1f));
        goldText = CreateText(shakeRoot, "Gold", new Vector2(0f, 715f), new Vector2(1000f, 80f), 56, new Color(1f, 0.85f, 0.2f));
        statusText = CreateText(shakeRoot, "Status", new Vector2(0f, 630f), new Vector2(1000f, 70f), 42, Color.white);
        itemNameText = CreateText(shakeRoot, "ItemName", new Vector2(0f, 540f), new Vector2(1040f, 80f), 52, new Color(0.7f, 1f, 0.95f));
        itemValueText = CreateText(shakeRoot, "ItemValue", new Vector2(0f, 470f), new Vector2(1000f, 60f), 42, new Color(1f, 0.9f, 0.5f));

        BuildCauldron();

        feedbackText = CreateText(shakeRoot, "Feedback", new Vector2(0f, -110f), new Vector2(1040f, 200f), 84, Color.white);
        feedbackText.color = new Color(1f, 1f, 1f, 0f);

        BuildGauge();

        hintText = CreateText(shakeRoot, "Hint", new Vector2(0f, -430f), new Vector2(1000f, 70f), 40, Color.white);

        BuildLanguageButtons(root);
        BuildChoicePanel(root);
        BuildDangerPanel(root);

        // 토스트(짧은 알림)
        toastBg = CreateImage(root, "ToastBg", new Vector2(0f, 380f), new Vector2(980f, 120f), new Color(0f, 0f, 0f, 0.75f), false);
        toastText = CreateText(toastBg.rectTransform, "ToastText", Vector2.zero, new Vector2(960f, 110f), 46, Color.white);
        toastBg.gameObject.SetActive(false);

        // 화면 번쩍임 오버레이 (맨 위, 터치는 통과)
        hitFlash = CreateImage(root, "HitFlash", Vector2.zero, Vector2.zero, new Color(1f, 1f, 1f, 0f), false);
        Stretch(hitFlash.rectTransform);
    }

    void BuildCauldron()
    {
        cauldronRoot = CreateRect(shakeRoot, "Cauldron");
        cauldronRoot.anchoredPosition = new Vector2(0f, 60f);
        cauldronRoot.sizeDelta = new Vector2(600f, 600f);

        cauldronGlow = CreateImage(cauldronRoot, "Glow", new Vector2(0f, 120f), new Vector2(620f, 520f), new Color(1f, 1f, 1f, 0.3f), false);
        CreateImage(cauldronRoot, "LegL", new Vector2(-150f, -70f), new Vector2(50f, 80f), new Color(0.12f, 0.1f, 0.12f), false);
        CreateImage(cauldronRoot, "LegR", new Vector2(150f, -70f), new Vector2(50f, 80f), new Color(0.12f, 0.1f, 0.12f), false);
        CreateImage(cauldronRoot, "Body", new Vector2(0f, 120f), new Vector2(460f, 360f), new Color(0.18f, 0.16f, 0.2f), false);
        CreateImage(cauldronRoot, "BodyShine", new Vector2(-150f, 120f), new Vector2(40f, 260f), new Color(1f, 1f, 1f, 0.08f), false);
        cauldronLiquid = CreateImage(cauldronRoot, "Liquid", new Vector2(0f, 260f), new Vector2(420f, 90f), LevelColors[0], false);
        CreateImage(cauldronRoot, "Rim", new Vector2(0f, 305f), new Vector2(510f, 40f), new Color(0.1f, 0.08f, 0.12f), false);
    }

    void BuildGauge()
    {
        RectTransform gauge = CreateRect(shakeRoot, "Gauge");
        gauge.anchoredPosition = new Vector2(0f, -300f);
        gauge.sizeDelta = new Vector2(GaugeW, GaugeH);

        CreateImage(gauge, "Border", Vector2.zero, new Vector2(GaugeW + 16f, GaugeH + 16f), new Color(0.03f, 0.02f, 0.04f), false);
        CreateImage(gauge, "Back", Vector2.zero, new Vector2(GaugeW, GaugeH), new Color(0.22f, 0.18f, 0.26f), false);
        successZone = CreateImage(gauge, "SuccessZone(Yellow)", Vector2.zero, new Vector2(GaugeW * 0.4f, GaugeH), new Color(1f, 0.85f, 0.1f), false).rectTransform;
        critZone = CreateImage(gauge, "CriticalZone(Purple)", Vector2.zero, new Vector2(GaugeW * 0.08f, GaugeH), new Color(0.65f, 0.2f, 1f), false).rectTransform;

        pointer = CreateImage(gauge, "Pointer", new Vector2(-GaugeW * 0.5f, 0f), new Vector2(16f, GaugeH + 60f), Color.white, false).rectTransform;
        Outline o = pointer.gameObject.AddComponent<Outline>();
        o.effectColor = new Color(0f, 0f, 0f, 0.9f);
        o.effectDistance = new Vector2(3f, -3f);
    }

    void BuildLanguageButtons(RectTransform root)
    {
        string[] codes = { "KR", "EN", "JP", "TW" };
        for (int i = 0; i < 4; i++)
        {
            int idx = i;
            Text label;
            Button b = CreateButton(root, "Lang_" + codes[i], Vector2.zero, new Vector2(110f, 60f),
                new Color(0.25f, 0.22f, 0.3f), out label, () => LocalizationManager.SetLanguage((LocalizationManager.Language)idx));
            label.text = codes[i]; // 언어 코드 자체는 번역 대상이 아님
            label.fontSize = 32;
            RectTransform rt = b.GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(1f, 1f);
            rt.anchoredPosition = new Vector2(-20f - (3 - i) * 120f, -20f);
            langButtons[i] = b;
        }
    }

    void BuildChoicePanel(RectTransform root)
    {
        Image panel = CreateImage(root, "ChoicePanel", new Vector2(0f, -680f), new Vector2(1000f, 480f), new Color(0.05f, 0.04f, 0.07f, 0.92f), true);
        choicePanel = panel.gameObject;
        RectTransform p = panel.rectTransform;

        choiceTitleText = CreateText(p, "ChoiceTitle", new Vector2(0f, 190f), new Vector2(960f, 70f), 44, new Color(1f, 0.9f, 0.6f));

        Button sell = CreateButton(p, "SellButton", new Vector2(0f, 60f), new Vector2(920f, 160f),
            new Color(0.85f, 0.65f, 0.1f), out sellLabel, OnSell);
        sellLabel.color = new Color(0.1f, 0.05f, 0f);

        Button refine = CreateButton(p, "RefineButton", new Vector2(0f, -130f), new Vector2(920f, 170f),
            new Color(0.6f, 0.15f, 0.85f), out refineLabel, OnRefine);

        choicePanel.SetActive(false);
    }

    void BuildDangerPanel(RectTransform root)
    {
        // 전체 화면을 덮어 다른 터치를 막는 반투명 막
        Image dim = CreateImage(root, "DangerPanel", Vector2.zero, Vector2.zero, new Color(0f, 0f, 0f, 0.55f), true);
        Stretch(dim.rectTransform);
        dangerPanel = dim.gameObject;

        dangerFlash = CreateImage(dim.rectTransform, "RedFlash", Vector2.zero, Vector2.zero, new Color(1f, 0f, 0f, 0f), false);
        Stretch(dangerFlash.rectTransform);

        Image box = CreateImage(dim.rectTransform, "DangerBox", new Vector2(0f, -40f), new Vector2(1000f, 960f), new Color(0.12f, 0.02f, 0.04f, 0.97f), true);
        RectTransform b = box.rectTransform;
        CreateImage(b, "TopStripe", new Vector2(0f, 465f), new Vector2(1000f, 30f), new Color(1f, 0.15f, 0.15f), false);

        dangerTitleText = CreateText(b, "DangerTitle", new Vector2(0f, 360f), new Vector2(960f, 110f), 84, new Color(1f, 0.25f, 0.25f));
        dangerMsgText = CreateText(b, "DangerMsg", new Vector2(0f, 200f), new Vector2(960f, 180f), 50, Color.white);
        dangerItemText = CreateText(b, "DangerItem", new Vector2(0f, 30f), new Vector2(960f, 140f), 42, new Color(1f, 0.85f, 0.5f));

        Button giveUp = CreateButton(b, "GiveUpButton", new Vector2(0f, -150f), new Vector2(900f, 140f),
            new Color(0.3f, 0.28f, 0.3f), out giveUpLabel, OnGiveUp);
        Button ad = CreateButton(b, "WatchAdButton", new Vector2(0f, -340f), new Vector2(900f, 180f),
            new Color(0.15f, 0.7f, 0.35f), out adLabel, OnWatchAd);

        dangerPanel.SetActive(false);
    }

    // ═════════════════════════════ UI 헬퍼 ═════════════════════════════
    static RectTransform CreateRect(RectTransform parent, string name)
    {
        GameObject go = new GameObject(name, typeof(RectTransform));
        RectTransform rt = go.GetComponent<RectTransform>();
        rt.SetParent(parent, false);
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        return rt;
    }

    static void Stretch(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    static Image CreateImage(RectTransform parent, string name, Vector2 pos, Vector2 size, Color color, bool raycast)
    {
        RectTransform rt = CreateRect(parent, name);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        Image img = rt.gameObject.AddComponent<Image>();
        img.color = color;
        img.raycastTarget = raycast;
        return img;
    }

    Text CreateText(RectTransform parent, string name, Vector2 pos, Vector2 size, int fontSize, Color color)
    {
        RectTransform rt = CreateRect(parent, name);
        rt.anchoredPosition = pos;
        rt.sizeDelta = size;
        Text t = rt.gameObject.AddComponent<Text>();
        t.font = font;
        t.fontSize = fontSize;
        t.color = color;
        t.alignment = TextAnchor.MiddleCenter;
        t.horizontalOverflow = HorizontalWrapMode.Wrap;
        t.verticalOverflow = VerticalWrapMode.Overflow;
        t.resizeTextForBestFit = true;
        t.resizeTextMinSize = 18;
        t.resizeTextMaxSize = fontSize;
        t.raycastTarget = false; // 글자가 터치를 가로막지 않도록
        Outline o = rt.gameObject.AddComponent<Outline>();
        o.effectColor = new Color(0f, 0f, 0f, 0.8f);
        o.effectDistance = new Vector2(2f, -2f);
        return t;
    }

    Button CreateButton(RectTransform parent, string name, Vector2 pos, Vector2 size, Color color, out Text label, UnityAction onClick)
    {
        Image img = CreateImage(parent, name, pos, size, color, true);
        Button b = img.gameObject.AddComponent<Button>();
        b.targetGraphic = img;
        Navigation nav = new Navigation();
        nav.mode = Navigation.Mode.None;
        b.navigation = nav;
        b.onClick.AddListener(onClick);
        label = CreateText(img.rectTransform, "Label", Vector2.zero, size - new Vector2(30f, 16f), 42, Color.white);
        return b;
    }
}
