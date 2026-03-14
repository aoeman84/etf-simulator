'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CompareChart from '@/components/charts/CompareChart'
import NumberSlider from '@/components/NumberSlider'
import { ETF_DATA, simulate, fmtKRW } from '@/lib/simulator'
import { usePersistedState } from '@/lib/usePersistedState'
import ScenarioModal, { ScenarioSettings } from '@/components/ScenarioModal'
import { YearResult } from '@/types'

const ALL_TICKERS = Object.keys(ETF_DATA)

const DEFAULT_SCENARIO: ScenarioSettings = {
  mode: 'optimistic',
  priceCAGRAdj: 0,
  divGrowthAdj: 0,
  inflationRate: 2.5,
}

export default function ComparePage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  // 탭 이동해도 유지되는 상태
  const [selected, setSelected] = usePersistedState<string[]>('compare_selected', ['SCHD', 'VOO', 'QQQ'])
  const [monthly, setMonthly] = usePersistedState<number>('compare_monthly', 500)
  const [years, setYears] = usePersistedState<number>('compare_years', 10)
  const [drip, setDrip] = usePersistedState<boolean>('compare_drip', true)
  const [scenario, setScenario] = usePersistedState<ScenarioSettings>('compare_scenario', DEFAULT_SCENARIO)

  const [fxRate, setFxRate] = useState(1350)
  const [fxLoaded, setFxLoaded] = useState(false)
  const [compareResults, setCompareResults] = useState<Record<string, YearResult[]>>({})
  const [shared, setShared] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})

  // 실시간 환율
  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) { setFxRate(d.rate); setFxLoaded(true) }
    }).catch(() => {})
  }, [])

  // 실시간 ETF 가격
  useEffect(() => {
    ALL_TICKERS.forEach(ticker => {
      fetch(`/api/etf-price?ticker=${ticker}`)
        .then(r => r.json())
        .then(d => { if (d.price) setLivePrices(prev => ({ ...prev, [ticker]: d.price })) })
        .catch(() => {})
    })
  }, [])

  // 시뮬레이션 — scenario를 primitive 값으로 분해해서 의존성 안정화
  const scenarioMode = scenario.mode
  const scenarioPriceAdj = scenario.priceCAGRAdj
  const scenarioDivAdj = scenario.divGrowthAdj

  useEffect(() => {
    const res: Record<string, YearResult[]> = {}
    selected.forEach(t => {
      const baseEtf = livePrices[t]
        ? { ...ETF_DATA[t], price: livePrices[t] }
        : { ...ETF_DATA[t] }

      // 시나리오 적용 (매번 새 객체로)
      const etf = { ...baseEtf }
      if (scenarioMode === 'pessimistic') {
        etf.priceCAGR = etf.priceCAGR * 0.5
        etf.divGrowthCAGR = 0
      } else if (scenarioMode === 'neutral' || scenarioMode === 'custom') {
        etf.priceCAGR = Math.max(0, etf.priceCAGR + scenarioPriceAdj)
        etf.divGrowthCAGR = Math.max(0, etf.divGrowthCAGR + scenarioDivAdj)
      }
      // optimistic = 그대로

      res[t] = simulate(etf, monthly * 10000, years, fxRate, drip)
    })
    setCompareResults(res)
  }, [selected, monthly, years, fxRate, drip, livePrices, scenarioMode, scenarioPriceAdj, scenarioDivAdj])

  async function shareResult() {
    const lines = selected.map(t => {
      const r = compareResults[t]
      const last = r?.[r.length - 1]
      if (!last) return ''
      return `${t}: 포트폴리오 ${fmtKRW(last.portfolioKRW)} · 월배당 ${fmtKRW(last.monthlyDivKRW)}`
    }).filter(Boolean).join('\n')
    const text = `📊 ETF 비교 시뮬레이션 결과\n\n${lines}\n\n⏱ ${years}년 · 월 ${monthly.toLocaleString()}만원\n\n🔗 https://etf-simulator-henna.vercel.app`
    if (navigator.share) {
      try { await navigator.share({ title: 'ETF 비교', text }); return } catch {}
    }
    await navigator.clipboard.writeText(text)
    setShared(true)
    setTimeout(() => setShared(false), 2500)
  }

  function toggleTicker(t: string) {
    setSelected(prev =>
      prev.includes(t)
        ? prev.length > 1 ? prev.filter(x => x !== t) : prev
        : [...prev, t]
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar titleSlot={<ScenarioModal scenario={scenario} onChange={setScenario} />} />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Controls */}
          <div className="card p-5 space-y-5 h-fit">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">ETF 선택 (최대 5개)</label>
              <div className="space-y-2">
                {ALL_TICKERS.map(t => {
                  const etf = ETF_DATA[t]
                  const active = selected.includes(t)
                  const livePrice = livePrices[t]
                  return (
                    <button key={t} onClick={() => toggleTicker(t)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${
                        active ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}>
                      <div className="font-semibold">{t}</div>
                      <div className="text-xs opacity-70 truncate">{etf.name}</div>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span>배당 {etf.divYield}%</span>
                        <span>주가↑ {etf.priceCAGR}%</span>
                        {livePrice && <span className="text-green-600 font-medium">${livePrice.toFixed(2)}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <NumberSlider label="월 투자금액" value={monthly} min={10} max={2000} step={10}
                display={`${monthly.toLocaleString()}만원`} unit="만원" onChange={setMonthly} />
              <NumberSlider label="투자 기간" value={years} min={1} max={30} step={1}
                display={`${years}년`} unit="년" onChange={setYears} />
              <NumberSlider label="환율" value={fxRate} min={1000} max={1800} step={10}
                display={`${fxRate.toLocaleString()}원`} unit="원" onChange={setFxRate}
                highlight={fxLoaded} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="drip2" checked={drip}
                  onChange={e => setDrip(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <label htmlFor="drip2" className="text-sm cursor-pointer">배당 재투자 (DRIP)</label>
              </div>
            </div>
          </div>

          {/* Charts & Table */}
          <div className="lg:col-span-3 space-y-6">
            {/* 공유 + 시나리오 배지 */}
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                scenario.mode === 'optimistic' ? 'bg-green-100 text-green-700' :
                scenario.mode === 'pessimistic' ? 'bg-red-100 text-red-700' :
                scenario.mode === 'neutral' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {{ optimistic: '🟢 낙관', neutral: '🟡 중립', pessimistic: '🔴 비관', custom: '⚙️ 직접설정' }[scenario.mode]}
              </span>
              <button onClick={shareResult}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                  shared ? 'border-green-300 bg-green-50 text-green-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}>
                {shared ? '✅ 복사됨' : (
                  <><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                  </svg>결과 공유</>
                )}
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {selected.map(t => {
                const r = compareResults[t]
                const last = r?.[r.length - 1]
                const etf = ETF_DATA[t]
                if (!last) return null
                return (
                  <div key={t} className="card p-4" style={{ borderTop: `3px solid ${etf.color}` }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-base">{t}</span>
                      <span className="text-xs text-slate-400">{years}년 후</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">포트폴리오</span>
                        <span className="font-semibold">{fmtKRW(last.portfolioKRW)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">수익률</span>
                        <span className="font-semibold text-green-600">+{last.gainPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">월 배당금</span>
                        <span className="font-semibold text-amber-600">{fmtKRW(last.monthlyDivKRW)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="card p-6">
              <h2 className="text-sm font-medium text-slate-500 mb-4">포트폴리오 성장 비교</h2>
              <CompareChart results={compareResults} years={years} />
            </div>

            {/* Comparison table */}
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-slate-700">ETF 기본 정보 비교</h2>
                {Object.keys(livePrices).length > 0 && (
                  <span className="text-xs text-green-500 flex items-center gap-1">● 실시간 가격 반영</span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['ETF', '현재가', '배당수익률', '배당성장(CAGR)', '주가상승(CAGR)', `${years}년 후 월배당`].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selected.map(t => {
                    const etf = ETF_DATA[t]
                    const r = compareResults[t]
                    const last = r?.[r.length - 1]
                    const livePrice = livePrices[t]
                    return (
                      <tr key={t} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: etf.color }} />
                            <span className="font-semibold">{t}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {livePrice
                            ? <span className="font-medium text-slate-800">${livePrice.toFixed(2)}</span>
                            : <span className="text-slate-500">${etf.price.toFixed(2)}</span>}
                        </td>
                        <td className="px-4 py-3 text-amber-600">{etf.divYield}%</td>
                        <td className="px-4 py-3 text-blue-600">{etf.divGrowthCAGR}%</td>
                        <td className="px-4 py-3 text-green-600">{etf.priceCAGR}%</td>
                        <td className="px-4 py-3 font-medium">{last ? fmtKRW(last.monthlyDivKRW) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
