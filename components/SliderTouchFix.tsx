'use client'
import { useEffect } from 'react'

/**
 * 모든 input[type="range"]에 대해 iOS Safari 슬라이더 드래그 버그를 수정합니다.
 * touchstart / touchmove 이벤트를 capture 단계에서 가로채어
 * 페이지 스크롤로 이어지지 않도록 e.preventDefault() + e.stopPropagation() 처리합니다.
 * Root layout에 한 번만 추가하면 앱 전체에 적용됩니다.
 */
export default function SliderTouchFix() {
  useEffect(() => {
    const isSlider = (t: EventTarget | null) =>
      t instanceof HTMLInputElement && t.type === 'range'

    const onTouchStart = (e: TouchEvent) => {
      if (isSlider(e.target)) e.stopPropagation()
    }

    const onTouchMove = (e: TouchEvent) => {
      if (isSlider(e.target)) {
        e.stopPropagation()
        e.preventDefault()   // 페이지 스크롤 차단 (passive: false 필수)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { capture: true, passive: false })

    return () => {
      document.removeEventListener('touchstart', onTouchStart, { capture: true } as EventListenerOptions)
      document.removeEventListener('touchmove',  onTouchMove,  { capture: true } as EventListenerOptions)
    }
  }, [])

  return null
}
