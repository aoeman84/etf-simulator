'use client'
import { useState, useEffect } from 'react'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  unit: string
  onChange: (v: number) => void
  highlight?: boolean   // 실시간 표시
  highlightLabel?: string // 커스텀 하이라이트 텍스트
}

export default function NumberSlider({
  label, value, min, max, step, display, unit, onChange, highlight, highlightLabel
}: Props) {
  const [inputVal, setInputVal] = useState(String(value))

  useEffect(() => { setInputVal(String(value)) }, [value])

  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          {label}
          {highlight && (
            <span className="text-xs text-green-500 font-normal">
              ● {highlightLabel ?? '실시간'}
            </span>
          )}
        </label>
        <span className="text-sm font-semibold text-blue-600">{display}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="flex-1 accent-blue-600"
          style={{ height: '28px' }}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <input
            type="number" min={min} max={max} step={step} value={inputVal}
            onChange={e => {
              setInputVal(e.target.value)
              const n = parseInt(e.target.value, 10)
              if (!isNaN(n) && n >= min && n <= max) onChange(n)
            }}
            onBlur={() => {
              const n = parseInt(inputVal, 10)
              const c = isNaN(n) ? min : Math.min(max, Math.max(min, n))
              setInputVal(String(c))
              onChange(c)
            }}
            className="w-16 text-right border border-slate-200 rounded-xl px-2 py-1 text-sm font-semibold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
            inputMode="numeric"
          />
          <span className="text-xs text-slate-500">{unit}</span>
        </div>
      </div>
    </div>
  )
}
