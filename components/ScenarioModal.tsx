'use client'
import { useState } from 'react'

export interface ScenarioSettings {
  mode: 'optimistic' | 'neutral' | 'pessimistic' | 'custom'
  priceCAGRAdj: number    // 주가 CAGR 조정값 (0 = 역사적 그대로)
  divGrowthAdj: number    // 배당성장 조정값
  inflationRate: number   // 인플레이션 (실질 수익률 계산용)
}

export const SCENARIOS: Record<string, { label: string; emoji: string; desc: string; priceCAGRAdj: number; divGrowthAdj: number; color: string }> = {
  optimistic: {
    label: '낙관',
    emoji: '🟢',
    color: 'green',
    desc: '2011~2024 강세장 역사적 수치 그대로 적용. S&P500 장기 평균 성장 지속 가정.',
    priceCAGRAdj: 0,
    divGrowthAdj: 0,
  },
  neutral: {
    label: '중립',
    emoji: '🟡',
    color: 'amber',
    desc: '금리 정상화 및 ETF 성숙 단계 진입 감안. 주가 CAGR -2%, 배당성장 -3% 조정.',
    priceCAGRAdj: -2,
    divGrowthAdj: -3,
  },
  pessimistic: {
    label: '비관',
    emoji: '🔴',
    color: 'red',
    desc: '고금리 장기화 + 경기침체 시나리오. 주가 CAGR 역사적 절반, 배당성장 0% 가정.',
    priceCAGRAdj: -999, // 절반 처리는 simulator에서
    divGrowthAdj: -999,
  },
  custom: {
    label: '직접설정',
    emoji: '⚙️',
    color: 'blue',
    desc: '주가 CAGR과 배당성장률을 직접 조정하세요.',
    priceCAGRAdj: 0,
    divGrowthAdj: 0,
  },
}

interface Props {
  scenario: ScenarioSettings
  onChange: (s: ScenarioSettings) => void
}

export default function ScenarioModal({ scenario, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const current = SCENARIOS[scenario.mode]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-all ${
          scenario.mode === 'optimistic' ? 'bg-green-50 border-green-200 text-green-700' :
          scenario.mode === 'pessimistic' ? 'bg-red-50 border-red-200 text-red-700' :
          scenario.mode === 'neutral' ? 'bg-amber-50 border-amber-200 text-amber-700' :
          'bg-blue-50 border-blue-200 text-blue-700'
        }`}
        title="시나리오 설정"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.474l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
        {current.emoji} {current.label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">📐 시나리오 설정</h2>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
              </div>

              {/* 시나리오 선택 */}
              <div className="space-y-2 mb-4">
                {Object.entries(SCENARIOS).map(([key, s]) => (
                  <button key={key}
                    onClick={() => {
                      onChange({
                        ...scenario,
                        mode: key as any,
                        priceCAGRAdj: s.priceCAGRAdj,
                        divGrowthAdj: s.divGrowthAdj,
                      })
                      if (key !== 'custom') setOpen(false)
                    }}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      scenario.mode === key
                        ? key === 'optimistic' ? 'border-green-400 bg-green-50' :
                          key === 'pessimistic' ? 'border-red-400 bg-red-50' :
                          key === 'neutral' ? 'border-amber-400 bg-amber-50' :
                          'border-blue-400 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{s.emoji} {s.label}</span>
                      {key !== 'custom' && key !== 'pessimistic' && (
                        <div className="flex gap-2 text-xs text-slate-500">
                          <span>주가 {s.priceCAGRAdj >= 0 ? '+' : ''}{s.priceCAGRAdj}%</span>
                          <span>배당성장 {s.divGrowthAdj >= 0 ? '+' : ''}{s.divGrowthAdj}%</span>
                        </div>
                      )}
                      {key === 'pessimistic' && (
                        <span className="text-xs text-slate-500">역사적 수치의 50%</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                  </button>
                ))}
              </div>

              {/* 직접 설정 슬라이더 */}
              {scenario.mode === 'custom' && (
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-slate-600">주가 CAGR 조정</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {scenario.priceCAGRAdj >= 0 ? '+' : ''}{scenario.priceCAGRAdj}%
                      </span>
                    </div>
                    <input type="range" min={-8} max={4} step={0.5}
                      value={scenario.priceCAGRAdj}
                      onChange={e => onChange({ ...scenario, priceCAGRAdj: Number(e.target.value) })}
                      className="w-full accent-blue-600" />
                    <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                      <span>-8%</span><span>0%</span><span>+4%</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-slate-600">배당성장 CAGR 조정</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {scenario.divGrowthAdj >= 0 ? '+' : ''}{scenario.divGrowthAdj}%
                      </span>
                    </div>
                    <input type="range" min={-13} max={4} step={0.5}
                      value={scenario.divGrowthAdj}
                      onChange={e => onChange({ ...scenario, divGrowthAdj: Number(e.target.value) })}
                      className="w-full accent-blue-600" />
                    <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                      <span>-13%</span><span>0%</span><span>+4%</span>
                    </div>
                  </div>
                  <button onClick={() => setOpen(false)} className="btn-primary w-full text-sm">
                    적용
                  </button>
                </div>
              )}

              {/* 인플레이션 */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-600">인플레이션율 (실질수익률 계산)</span>
                  <span className="text-sm font-semibold text-slate-700">{scenario.inflationRate}%</span>
                </div>
                <input type="range" min={0} max={6} step={0.5}
                  value={scenario.inflationRate}
                  onChange={e => onChange({ ...scenario, inflationRate: Number(e.target.value) })}
                  className="w-full accent-slate-500" />
                <p className="text-xs text-slate-400 mt-1">한국 장기 평균 인플레이션 약 2.5%</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
