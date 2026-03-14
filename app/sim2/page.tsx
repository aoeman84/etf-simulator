'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import TaxPanel from '@/components/TaxPanel'
import NumberSlider from '@/components/NumberSlider'
import ScenarioModal, { ScenarioSettings } from '@/components/ScenarioModal'
import { ETF_DATA, fmtKRW, simulate } from '@/lib/simulator'
import { usePersistedState } from '@/lib/usePersistedState'
import { DEFAULT_TAX } from '@/lib/tax'
import { TaxSettings } from '@/types'

const DEFAULT_SCENARIO: ScenarioSettings = {
  mode: 'optimistic',
  priceCAGRAdj: 0,
  divGrowthAdj: 0,
  inflationRate: 2.5,
}

export default function Sim2Page() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  // 탭 이동해도 유지되는 상태
  const [targetDiv, setTargetDiv] = usePersistedState<number>('sim2_targetDiv', 300)
  const [ticker, setTicker] = usePersistedState<string>('sim2_ticker', 'SCHD')
  const [years, setYears] = usePersistedState<number>('sim2_years', 10)
  const [drip, setDrip] = usePersistedState<boolean>('sim2_drip', true)
  const [tax, setTax] = usePersistedState<TaxSettings>('sim2_tax', DEFAULT_TAX)
  const [scenario, setScenario] = usePersistedState<ScenarioSettings>('sim2_scenario', DEFAULT_SCENARIO)
  const [activePanel, setActivePanel] = usePersistedState<'goal' | 'tax'>('sim2_panel', 'goal')

  const [fxRate, setFxRate] = useState(1350)
  const [fxLoaded, setFxLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) { setFxRate(d.rate); setFxLoaded(true) }
    }).catch(() => {})
  }, [])

  const etf = ETF_DATA[ticker]

  // 세후 목표 기준 역산: 세전으로 환산
  function grossTarget(): number {
    if (!tax.enabled || !tax.withholdingTax) return targetDiv * 10000 * 12
    // 원천징수 15% → 세전 = 세후 / 0.85
    // 종합소득세는 추정하기 어려우므로 원천징수만 반영
    return (targetDiv * 10000 * 12) / 0.85
  }

  // 역산: 이진탐색으로 필요 월 투자금 계산
  function calcRequired(): number {
    const targetAnnual = grossTarget()
    let lo = 10, hi = 10000
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2
      const r = simulateForGoal(mid, years, fxRate, drip)
      const lastDiv = r[r.length - 1]?.annualDivKRW ?? 0
      if (lastDiv < targetAnnual) lo = mid
      else hi = mid
    }
    return Math.ceil((lo + hi) / 2 / 10) * 10
  }

  function simulateForGoal(monthlyMan: number, yrs: number, fx: number, dripOn: boolean) {
    const etfAdj = { ...etf }
    if (scenario.mode === 'pessimistic') {
      etfAdj.priceCAGR = etfAdj.priceCAGR * 0.5
      etfAdj.divGrowthCAGR = 0
    } else if (scenario.mode !== 'optimistic') {
      etfAdj.priceCAGR = Math.max(0, etfAdj.priceCAGR + scenario.priceCAGRAdj)
      etfAdj.divGrowthCAGR = Math.max(0, etfAdj.divGrowthCAGR + scenario.divGrowthAdj)
    }
    return simulate(etfAdj, monthlyMan * 10000, yrs, fx, dripOn, tax)
  }

  const required = calcRequired()
  const preview = simulateForGoal(required, years, fxRate, drip)
  const last = preview[preview.length - 1]

  // 실질 가치 (인플레이션)
  function realValue(v: number): number {
    return v / Math.pow(1 + scenario.inflationRate / 100, years)
  }

  // 세후 월 배당금 계산
  const afterTaxMonthly = last
    ? (tax.enabled ? last.tax.afterTaxMonthlyDivKRW : last.monthlyDivKRW)
    : 0

  // 달성률
  const achieveRate = afterTaxMonthly > 0
    ? Math.min(100, (afterTaxMonthly / (targetDiv * 10000)) * 100)
    : 0

  const [shared, setShared] = useState(false)
  async function shareResult() {
    if (!last) return
    const text =
      `🎯 ETF 목표 역산 결과\n\n` +
      `📌 ${ticker} · ${years}년 · 목표 월배당 ${targetDiv.toLocaleString()}만원\n` +
      `💰 필요 월 투자금: ${required.toLocaleString()}만원\n` +
      `🏦 포트폴리오: ${fmtKRW(last.portfolioKRW)}\n` +
      `📊 수익률: +${last.gainPct.toFixed(1)}%\n\n` +
      `🔗 https://etf-simulator-henna.vercel.app`
    if (navigator.share) {
      try { await navigator.share({ title: 'ETF 목표 역산', text }); return } catch {}
    }
    await navigator.clipboard.writeText(text)
    setShared(true)
    setTimeout(() => setShared(false), 2500)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        titleSlot={<ScenarioModal scenario={scenario} onChange={setScenario} />}
      />
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* 왼쪽 패널 */}
          <div className="lg:col-span-1 space-y-4">

            {/* 패널 탭 */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 gap-1">
              <PanelBtn active={activePanel === 'goal'} onClick={() => setActivePanel('goal')}>
                🎯 목표 설정
              </PanelBtn>
              <PanelBtn active={activePanel === 'tax'} onClick={() => setActivePanel('tax')}>
                🧾 세금 설정
                {tax.enabled && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />}
              </PanelBtn>
            </div>

            {activePanel === 'goal' && (
              <div className="card p-5 space-y-5">
                {/* 목표 월 배당 */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    목표 월 배당금
                    {tax.enabled && <span className="text-xs text-slate-400 font-normal ml-1">(세후)</span>}
                  </label>
                  <NumberSlider label="" value={targetDiv} min={50} max={3000} step={50}
                    display={`${targetDiv.toLocaleString()}만원`} unit="만원" onChange={setTargetDiv} />
                </div>

                {/* ETF 선택 */}
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">ETF</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {Object.keys(ETF_DATA).map(t => {
                      const e = ETF_DATA[t]
                      return (
                        <button key={t} onClick={() => setTicker(t)}
                          className={`text-left px-3 py-2 rounded-xl border text-sm transition-all ${
                            ticker === t
                              ? 'border-blue-400 bg-blue-50 text-blue-700'
                              : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{t}</span>
                            <div className="flex gap-2 text-xs opacity-60">
                              <span>배당 {e.divYield}%</span>
                              <span>성장 {e.divGrowthCAGR}%</span>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 투자 기간 */}
                <NumberSlider label="투자 기간" value={years} min={1} max={30} step={1}
                  display={`${years}년`} unit="년" onChange={setYears} />

                {/* 환율 */}
                <NumberSlider label="환율" value={fxRate} min={1000} max={1800} step={10}
                  display={`${fxRate.toLocaleString()}원`} unit="원" onChange={setFxRate}
                  highlight={fxLoaded} />

                {/* DRIP */}
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="drip2" checked={drip}
                    onChange={e => setDrip(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="drip2" className="text-sm cursor-pointer select-none">배당 재투자 (DRIP)</label>
                </div>
              </div>
            )}

            {activePanel === 'tax' && (
              <div className="card p-5">
                <p className="text-xs text-slate-400 mb-4">
                  여기서 설정한 세금은 Sim²에서만 적용됩니다.
                </p>
                <TaxPanel tax={tax} onChange={setTax} />
              </div>
            )}
          </div>

          {/* 오른쪽: 결과 */}
          <div className="lg:col-span-3 space-y-5">

            {/* 메인 결과 카드 */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-medium text-slate-500">목표 달성을 위한 월 투자금</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={shareResult}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${shared ? 'border-green-300 bg-green-50 text-green-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    {shared ? '✅ 복사됨' : <><svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>공유</>}
                  </button>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  scenario.mode === 'optimistic' ? 'bg-green-100 text-green-700' :
                  scenario.mode === 'pessimistic' ? 'bg-red-100 text-red-700' :
                  scenario.mode === 'neutral' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                    {{ optimistic:'🟢 낙관', neutral:'🟡 중립', pessimistic:'🔴 비관', custom:'⚙️ 직접설정' }[scenario.mode]}
                  </span>
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="text-xs text-slate-400 mb-1">
                  {ticker}에 {years}년간 매월
                  {tax.enabled ? ` · 세후 ${targetDiv.toLocaleString()}만원 목표` : ` · 세전 ${targetDiv.toLocaleString()}만원 목표`}
                </div>
                <div className="text-5xl font-black text-blue-600 tracking-tight">
                  {required.toLocaleString()}
                  <span className="text-2xl font-bold text-slate-400 ml-1">만원</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  총 투자원금 {fmtKRW(required * years * 12 * 10000)}
                </div>
              </div>

              {/* 달성률 바 */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>목표 달성률</span>
                  <span className="font-semibold text-blue-600">{achieveRate.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${achieveRate}%` }}
                  />
                </div>
              </div>

              {/* 결과 지표 그리드 */}
              {last && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ResultCard
                    label={`${years}년 후 포트폴리오`}
                    value={fmtKRW(last.portfolioKRW)}
                    sub={scenario.inflationRate > 0 ? `실질 ${fmtKRW(realValue(last.portfolioKRW))}` : undefined}
                    color="blue"
                  />
                  <ResultCard
                    label="월 배당금"
                    value={fmtKRW(afterTaxMonthly)}
                    sub={tax.enabled ? '세후' : '세전'}
                    color="amber"
                  />
                  <ResultCard
                    label="수익률"
                    value={`+${last.gainPct.toFixed(1)}%`}
                    color="green"
                  />
                  <ResultCard
                    label="총 투자원금"
                    value={fmtKRW(last.invested)}
                  />
                </div>
              )}
            </div>

            {/* 세금 영향 카드 (세금 활성시) */}
            {tax.enabled && last && (
              <div className="card p-5">
                <h3 className="text-sm font-medium text-slate-500 mb-4">세금 영향 분석</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">세전 월 배당</div>
                    <div className="text-lg font-bold text-slate-400 line-through decoration-red-400">
                      {fmtKRW(last.monthlyDivKRW)}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl mb-1">→</div>
                      <div className="text-xs text-red-500 font-medium">
                        -{fmtKRW(last.tax.totalDivTaxKRW / 12)}/월 세금
                      </div>
                      {last.tax.exceedsThreshold && (
                        <div className="text-xs text-orange-500 mt-0.5">⚠️ 종합과세 대상</div>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">세후 월 배당</div>
                    <div className="text-lg font-bold text-blue-600">
                      {fmtKRW(last.tax.afterTaxMonthlyDivKRW)}
                    </div>
                  </div>
                </div>
                {tax.withholdingTax && (
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    * 원천징수 15% 반영 기준 역산 · 종합소득세는 개인 상황에 따라 다를 수 있음
                  </p>
                )}
              </div>
            )}

            {/* 연도별 진행 테이블 */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-medium text-slate-700">연도별 배당 성장 추이</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '460px' }}>
                  <thead className="bg-slate-50">
                    <tr>
                      {['연도', '투자원금', '포트폴리오', tax.enabled ? '세후 월배당' : '월 배당금', '수익률',
                        scenario.inflationRate > 0 ? '실질가치' : ''].filter(Boolean).map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map(r => (
                      <tr key={r.year} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                          {r.year}년차
                          {r.tax.exceedsThreshold && tax.enabled &&
                            <span className="ml-1 text-xs text-orange-500">⚠️</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtKRW(r.invested)}</td>
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{fmtKRW(r.portfolioKRW)}</td>
                        <td className="px-4 py-3 text-amber-600 font-medium whitespace-nowrap">
                          {fmtKRW(tax.enabled ? r.tax.afterTaxMonthlyDivKRW : r.monthlyDivKRW)}
                        </td>
                        <td className="px-4 py-3 text-green-600 font-medium whitespace-nowrap">
                          +{r.gainPct.toFixed(1)}%
                        </td>
                        {scenario.inflationRate > 0 && (
                          <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                            {fmtKRW(r.portfolioKRW / Math.pow(1 + scenario.inflationRate / 100, r.year))}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function PanelBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 text-sm py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
      }`}>
      {children}
    </button>
  )
}

function ResultCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600',
  }
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-base font-bold ${color ? colors[color] : 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
