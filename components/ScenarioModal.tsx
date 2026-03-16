'use client'
import { useState } from 'react'
import { ETF_DATA, ETF_DATA_UPDATED_AT } from '@/lib/simulator'
import { SCENARIO_YIELD, getScenarioMode } from '@/lib/simulatorK'

export interface ScenarioSettings {
  mode: 'optimistic' | 'neutral' | 'pessimistic' | 'custom'
  priceCAGRAdj: number
  divGrowthAdj: number
  inflationRate: number
}

export const SCENARIOS: Record<string, {
  label: string; emoji: string; desc: string
  priceCAGRAdj: number; divGrowthAdj: number; color: string
}> = {
  optimistic: {
    label: '낙관', emoji: '🟢', color: 'green',
    desc: '2011~2024 강세장 역사적 수치 그대로 적용. S&P500 장기 평균 성장 지속 가정.',
    priceCAGRAdj: 0, divGrowthAdj: 0,
  },
  neutral: {
    label: '중립', emoji: '🟡', color: 'amber',
    desc: '금리 정상화 및 ETF 성숙 단계 진입 감안. 주가 CAGR -2%, 배당성장 -3% 조정.',
    priceCAGRAdj: -2, divGrowthAdj: -3,
  },
  pessimistic: {
    label: '비관', emoji: '🔴', color: 'red',
    desc: '고금리 장기화 + 경기침체 시나리오. 주가 CAGR 역사적 절반, 배당성장 0% 가정.',
    priceCAGRAdj: -999, divGrowthAdj: -999,
  },
  custom: {
    label: '직접설정', emoji: '⚙️', color: 'blue',
    desc: '주가 CAGR과 배당성장률을 직접 조정하세요.',
    priceCAGRAdj: 0, divGrowthAdj: 0,
  },
}

interface Props {
  scenario: ScenarioSettings
  onChange: (s: ScenarioSettings) => void
  selectedTickers?: string[]
  useSimkYield?: boolean
}

function getEffectiveCAGR(base: number, adj: number, mode: string): number {
  if (mode === 'pessimistic') return Math.max(0, base * 0.5)
  return Math.max(0, base + adj)
}

export default function ScenarioModal({ scenario, onChange, selectedTickers, useSimkYield }: Props) {
  const [open, setOpen] = useState(false)
  const current = SCENARIOS[scenario.mode]

  const btnClass = {
    optimistic:  'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
    neutral:     'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    pessimistic: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
    custom:      'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  }[scenario.mode]

  const tickersToShow = selectedTickers?.length
    ? selectedTickers.filter(t => ETF_DATA[t])
    : Object.keys(ETF_DATA)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${btnClass}`}
        title="시나리오 설정"
      >
        {current.emoji} {current.label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl"
            onClick={e => e.stopPropagation()}
          >
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
                        ? key === 'optimistic' ? 'border-green-400 bg-green-50'
                        : key === 'pessimistic' ? 'border-red-400 bg-red-50'
                        : key === 'neutral' ? 'border-amber-400 bg-amber-50'
                        : 'border-blue-400 bg-blue-50'
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

              {/* ✅ ETF별 실제 적용 수치 표 */}
              <div className="border border-slate-100 rounded-xl overflow-hidden mb-4">
                <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">
                    현재 시나리오 적용 수치
                  </span>
                  <span className="text-xs text-slate-400">기준: {ETF_DATA_UPDATED_AT}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: '360px' }}>
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-3 py-2 text-slate-500 font-medium">ETF</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-medium">배당수익률</th>
                        <th className="text-right px-3 py-2 text-slate-500 font-medium">주가 CAGR</th>
                        {!useSimkYield && <th className="text-right px-3 py-2 text-slate-500 font-medium">배당성장</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tickersToShow.map(ticker => {
                        const etf = ETF_DATA[ticker]
                        const effPrice = getEffectiveCAGR(etf.priceCAGR, scenario.priceCAGRAdj, scenario.mode)
                        const effDiv = getEffectiveCAGR(etf.divGrowthCAGR, scenario.divGrowthAdj, scenario.mode)
                        const isAdjusted = scenario.mode !== 'optimistic'
                        const priceChanged = isAdjusted && Math.abs(effPrice - etf.priceCAGR) > 0.01
                        const divChanged = isAdjusted && Math.abs(effDiv - etf.divGrowthCAGR) > 0.01

                        // SimK: SCENARIO_YIELD 기반 배당수익률
                        const simkMode = getScenarioMode({ priceCAGRAdj: scenario.priceCAGRAdj, divGrowthAdj: scenario.divGrowthAdj, mode: scenario.mode })
                        const simkYield = useSimkYield ? (SCENARIO_YIELD[simkMode]?.[ticker] ?? etf.divYield / 100) : null
                        const baseSimkYield = useSimkYield ? (SCENARIO_YIELD['optimistic']?.[ticker] ?? etf.divYield / 100) : null
                        const simkYieldChanged = useSimkYield && simkMode !== 'optimistic' && simkYield !== baseSimkYield

                        return (
                          <tr key={ticker} className="hover:bg-slate-50">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ background: etf.color }} />
                                <span className="font-semibold text-slate-700">{ticker}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right text-amber-600 font-medium">
                              {useSimkYield && simkYield !== null ? (
                                <>
                                  <span className={simkYieldChanged ? 'text-orange-600 font-semibold' : ''}>
                                    {(simkYield * 100).toFixed(1)}%
                                  </span>
                                  {simkYieldChanged && baseSimkYield !== null && (
                                    <span className="text-slate-400 ml-1 line-through">
                                      {(baseSimkYield * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </>
                              ) : (
                                `${etf.divYield}%`
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span className={priceChanged ? 'text-orange-600 font-semibold' : 'text-green-600 font-medium'}>
                                {effPrice.toFixed(1)}%
                              </span>
                              {priceChanged && (
                                <span className="text-slate-400 ml-1 line-through">{etf.priceCAGR}%</span>
                              )}
                            </td>
                            {!useSimkYield && (
                              <td className="px-3 py-2 text-right">
                                <span className={divChanged ? 'text-orange-600 font-semibold' : 'text-blue-600 font-medium'}>
                                  {effDiv.toFixed(1)}%
                                </span>
                                {divChanged && (
                                  <span className="text-slate-400 ml-1 line-through">{etf.divGrowthCAGR}%</span>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {useSimkYield
                      ? '배당수익률: 시나리오별 고정 yield (SCENARIO_YIELD 기반) · 취소선 = 낙관 기준값 · 주황색 = 조정됨'
                      : '취소선 = 낙관 기준값 · 주황색 = 시나리오 조정 적용됨'}
                  </p>
                </div>
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
