'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import SimChart from '@/components/charts/SimChart'
import TaxPanel from '@/components/TaxPanel'
import TaxSummary from '@/components/TaxSummary'
import InstallPrompt from '@/components/InstallPrompt'
import Footer from '@/components/Footer'
import ScenarioModal, { ScenarioSettings } from '@/components/ScenarioModal'
import MultiETF, { ETFAllocation } from '@/components/MultiETF'
import { simulateMulti, fmtKRW } from '@/lib/simulator'
import { usePersistedState } from '@/lib/usePersistedState'
import { DEFAULT_TAX } from '@/lib/tax'
import { TaxSettings, YearResult } from '@/types'

type Tab = 'simulator' | 'tax'

const DEFAULT_SCENARIO: ScenarioSettings = {
  mode: 'optimistic',
  priceCAGRAdj: 0,
  divGrowthAdj: 0,
  inflationRate: 2.5,
}

export default function DashboardPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [allocations, setAllocations] = usePersistedState<ETFAllocation[]>('sim_allocations', [{ ticker: 'SCHD', monthly: 500 }])
  const [years, setYears] = usePersistedState<number>('sim_years', 10)
  const [drip, setDrip] = usePersistedState<boolean>('sim_drip', true)
  const [tax, setTax] = usePersistedState<TaxSettings>('sim_tax', DEFAULT_TAX)
  const [scenario, setScenario] = usePersistedState<ScenarioSettings>('scenario', DEFAULT_SCENARIO)
  const [fxRate, setFxRate] = useState(1350)
  const [results, setResults] = useState<YearResult[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('simulator')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [shared, setShared] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(10)
  const [fxLoaded, setFxLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) { setFxRate(d.rate); setFxLoaded(true) }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const res = simulateMulti(
      allocations.map(a => ({ ticker: a.ticker, monthlyKRW: a.monthly * 10000 })),
      years, fxRate, drip, tax, scenario
    )
    setResults(res)
    setSelectedYear(prev => Math.min(prev, years))
  }, [allocations, years, fxRate, drip, tax, scenario])

  const last = results[results.length - 1]
  const selectedResult = results.find(r => r.year === selectedYear) ?? last
  const totalMonthly = allocations.reduce((s, a) => s + a.monthly, 0)

  function realValue(nominalKRW: number, yearsN: number): number {
    return nominalKRW / Math.pow(1 + scenario.inflationRate / 100, yearsN)
  }

  async function savePortfolio() {
    setSaving(true)
    const name = allocations.length === 1
      ? `${allocations[0].ticker} ${allocations[0].monthly}만원 × ${years}년`
      : `분산(${allocations.map(a => a.ticker).join('+')}) ${totalMonthly}만원 × ${years}년`
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, settings: { allocations, years, fxRate, drip, tax, scenario } }),
    })
    setSaving(false); setSaved(true)
    setShowToast(true)
    setTimeout(() => { setSaved(false); setShowToast(false) }, 3000)
  }

  async function shareResult() {
    if (!last) return
    const tickers = allocations.map(a => `${a.ticker} ${a.monthly}만원`).join(' + ')
    const text =
      `📈 ETF 적립식 투자 시뮬레이션 결과\n\n` +
      `💼 ${tickers} · ${years}년\n` +
      `🏦 포트폴리오: ${fmtKRW(last.portfolioKRW)}\n` +
      `💰 월 배당: ${fmtKRW(tax.enabled ? last.tax.afterTaxMonthlyDivKRW : last.monthlyDivKRW)}${tax.enabled ? ' (세후)' : ''}\n` +
      `📊 수익률: +${last.gainPct.toFixed(1)}%\n\n` +
      `🔗 https://etf-simulator-henna.vercel.app`
    if (navigator.share) {
      try { await navigator.share({ title: 'ETF 시뮬레이션 결과', text }); return } catch {}
    }
    await navigator.clipboard.writeText(text)
    setShared(true)
    setTimeout(() => setShared(false), 2500)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar titleSlot={<ScenarioModal scenario={scenario} onChange={setScenario} useSimkYield={false} />} />
      <InstallPrompt />
      {showToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <span>💾</span>
          <span>My PF에 저장됐어요!</span>
          <a href="/portfolio" className="text-blue-300 underline text-xs ml-1">확인하기 →</a>
        </div>
      )}
      <div className="bg-white border-b border-slate-100 py-2 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">💡 적립식 ETF 투자 시뮬레이터 · 월 투자금과 ETF를 설정하면 장기 수익을 예측합니다</div>
      </div>
      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── 왼쪽 패널 ── */}
          <div className="space-y-4">
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 gap-1">
              <TabBtn active={activeTab === 'simulator'} onClick={() => setActiveTab('simulator')}>
                📊 투자 설정
              </TabBtn>
              <TabBtn active={activeTab === 'tax'} onClick={() => setActiveTab('tax')}>
                🧾 세금 설정
                {tax.enabled && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />}
              </TabBtn>
            </div>

            {activeTab === 'simulator' && (
              <div className="card p-5 space-y-5">
                <MultiETF
                  allocations={allocations}
                  onChange={setAllocations}
                  actionSlot={
                    <>
                      <button
                        onClick={savePortfolio}
                        disabled={saving}
                        title={saved ? '저장됨' : '포트폴리오 저장'}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all disabled:opacity-40 text-base ${
                          saved ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        {saved ? '✅' : '💾'}
                      </button>
                      <button
                        onClick={shareResult}
                        title={shared ? '복사됨!' : '결과 공유'}
                        className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                          shared
                            ? 'border-green-300 bg-green-50 text-green-600'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        {shared ? (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                            <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                          </svg>
                        )}
                      </button>
                    </>
                  }
                />
                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <NumberSlider label="투자 기간" value={years} min={1} max={30} step={1}
                    display={`${years}년`} unit="년" onChange={setYears} />
                  <NumberSlider label="환율" value={fxRate} min={1000} max={1800} step={10}
                    display={`${fxRate.toLocaleString()}원`} unit="원" onChange={setFxRate}
                    highlight={fxLoaded} />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="drip" checked={drip}
                    onChange={e => setDrip(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="drip" className="text-sm cursor-pointer select-none">배당 재투자 (DRIP)</label>
                </div>
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="card p-5"><TaxPanel tax={tax} onChange={setTax} /></div>
            )}

            {tax.enabled && selectedResult && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-500">세금 상세</label>
                  <select className="input text-xs py-1 w-24" value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}>
                    {results.map(r => <option key={r.year} value={r.year}>{r.year}년차</option>)}
                  </select>
                </div>
                {/* ✅ otherFinancialIncomeKRW, otherIncomeKRW 전달 */}
                <TaxSummary
                  result={selectedResult}
                  taxEnabled={tax.enabled}
                  otherFinancialIncomeKRW={tax.otherFinancialIncomeKRW ?? 0}
                  otherIncomeKRW={tax.otherIncomeKRW ?? 0}
                />
              </div>
            )}
          </div>

          {/* ── 오른쪽 ── */}
          <div className="lg:col-span-2 space-y-5">
            {last && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="총 투자원금" value={fmtKRW(last.invested)} />
                <StatCard label={`${years}년 후 포트폴리오`} value={fmtKRW(last.portfolioKRW)} color="blue"
                  sub={scenario.inflationRate > 0 ? `실질 ${fmtKRW(realValue(last.portfolioKRW, years))}` : undefined} />
                <StatCard label="세후 월 배당금"
                  value={fmtKRW(tax.enabled ? last.tax.afterTaxMonthlyDivKRW : last.monthlyDivKRW)}
                  color="amber" badge={tax.enabled ? '세후' : undefined} />
                <StatCard label="세후 실현 차익"
                  value={fmtKRW(tax.enabled ? last.tax.afterTaxGainKRW : last.gainKRW)}
                  color="green" badge={tax.enabled ? '매도시' : undefined} />
              </div>
            )}

            {scenario.inflationRate > 0 && last && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-lg">💸</span>
                <div className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">실질 구매력 기준</span>
                  {' '}(인플레이션 {scenario.inflationRate}% 반영): {years}년 후 포트폴리오의 오늘 가치는{' '}
                  <span className="font-semibold text-blue-600">{fmtKRW(realValue(last.portfolioKRW, years))}</span>
                </div>
              </div>
            )}

            {tax.enabled && last && (
              <div className="bg-gradient-to-r from-blue-50 to-red-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-xs font-semibold text-slate-500 mb-3">세전 vs 세후 비교 ({years}년차)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">세전 월 배당금</div>
                    <div className="text-lg font-bold text-slate-400 line-through decoration-red-400">{fmtKRW(last.monthlyDivKRW)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">세후 월 배당금 💰</div>
                    <div className="text-lg font-bold text-blue-600">{fmtKRW(last.tax.afterTaxMonthlyDivKRW)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">세전 차익</div>
                    <div className="text-lg font-bold text-slate-400 line-through decoration-red-400">{fmtKRW(last.gainKRW)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">매도 후 세후 차익 💰</div>
                    <div className="text-lg font-bold text-green-600">{fmtKRW(last.tax.afterTaxGainKRW)}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-slate-500">연도별 자산 성장</h2>
                <ScenarioModal scenario={scenario} onChange={setScenario} useSimkYield={false} />
              </div>
              <SimChart results={results} taxEnabled={tax.enabled} />
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' as any }}>
                <table className="w-full text-sm" style={{ minWidth: '500px' }}>
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-3 font-medium text-slate-500 text-xs whitespace-nowrap sticky left-0 bg-slate-50 z-10">연도</th>
                      {['투자원금', '포트폴리오', '수익률',
                        tax.enabled ? '세후 월배당' : '월 배당금',
                        scenario.inflationRate > 0 ? '실질 포트폴리오' : '',
                        tax.enabled ? '세금 부담' : ''].filter(Boolean).map(h => (
                        <th key={h} className="text-left px-3 py-3 font-medium text-slate-500 text-xs whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {results.map(r => (
                      <tr key={r.year}
                        className={`hover:bg-slate-50 cursor-pointer ${r.year === selectedYear ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedYear(r.year)}>
                        <td className="px-3 py-3 font-medium whitespace-nowrap sticky left-0 bg-white z-10"
                          style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                          {r.year}년차
                          {r.tax.exceedsThreshold && tax.enabled && <span className="ml-1 text-xs text-orange-500">⚠️</span>}
                        </td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{fmtKRW(r.invested)}</td>
                        <td className="px-3 py-3 font-medium whitespace-nowrap">{fmtKRW(r.portfolioKRW)}</td>
                        <td className={`px-3 py-3 font-medium whitespace-nowrap ${r.gainPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          +{r.gainPct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-amber-600 font-medium whitespace-nowrap">
                          {fmtKRW(tax.enabled ? r.tax.afterTaxMonthlyDivKRW : r.monthlyDivKRW)}
                        </td>
                        {scenario.inflationRate > 0 && (
                          <td className="px-3 py-3 text-slate-400 text-xs whitespace-nowrap">
                            {fmtKRW(realValue(r.portfolioKRW, r.year))}
                          </td>
                        )}
                        {tax.enabled && (
                          <td className="px-3 py-3 text-red-500 text-xs whitespace-nowrap">
                            -{fmtKRW(r.tax.totalDivTaxKRW)}/년
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tax.enabled && (
                <div className="px-4 py-2 bg-orange-50 border-t border-orange-100 text-xs text-orange-600">
                  ⚠️ 표시된 행은 금융소득 종합과세 대상 · 행 클릭 시 세금 상세 확인
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function TabBtn({ active, onClick, children }: {
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

function NumberSlider({ label, value, min, max, step, display, unit, onChange, highlight }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; unit: string; onChange: (v: number) => void; highlight?: boolean
}) {
  const [inputVal, setInputVal] = useState(String(value))
  useEffect(() => { setInputVal(String(value)) }, [value])
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          {label}
          {highlight && <span className="text-xs text-green-500 font-normal">● 실시간</span>}
        </label>
        <span className="text-sm font-semibold text-blue-600">{display}</span>
      </div>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          onTouchStart={e => e.stopPropagation()}
          onTouchMove={e => e.stopPropagation()}
          className="flex-1 accent-blue-600" style={{ height: '28px' }} />
        <div className="flex items-center gap-1 flex-shrink-0">
          <input type="number" min={min} max={max} step={step} value={inputVal}
            onChange={e => { setInputVal(e.target.value); const n = parseInt(e.target.value, 10); if (!isNaN(n) && n >= min && n <= max) onChange(n) }}
            onBlur={() => { const n = parseInt(inputVal, 10); const c = isNaN(n) ? min : Math.min(max, Math.max(min, n)); setInputVal(String(c)); onChange(c) }}
            className="w-16 text-right border border-slate-200 rounded-xl px-2 py-1 text-sm font-semibold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
            inputMode="numeric" />
          <span className="text-xs text-slate-500">{unit}</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color, badge, sub }: {
  label: string; value: string; color?: string; badge?: string; sub?: string
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600',
  }
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1 mb-1">
        <div className="text-xs text-slate-500 truncate">{label}</div>
        {badge && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">{badge}</span>}
      </div>
      <div className={`text-base font-bold ${color ? colors[color] : 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
