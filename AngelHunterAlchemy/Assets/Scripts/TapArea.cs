using System;
using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// 화면 전체를 덮는 투명 터치 영역.
/// 마우스 좌클릭 / 손가락 터치가 "눌리는 순간" 바로 신호를 보낸다(떼는 순간이 아니라서 반응이 빠름).
/// 버튼 위를 누르면 버튼이 먼저 반응하고, 이 영역에는 신호가 오지 않는다.
/// </summary>
public class TapArea : MonoBehaviour, IPointerDownHandler
{
    public Action OnTap;

    public void OnPointerDown(PointerEventData eventData)
    {
        if (OnTap != null) OnTap();
    }
}
