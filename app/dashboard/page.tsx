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
import { ETF_DATA, simulate, fmtKRW } from '@/lib/simulator'
import { DEFAULT_TAX } from '@/lib/tax'
import { TaxSettings, YearResult } from '@/types'

type Tab = 'simulator' | 'tax'

export default function DashboardPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [monthly, setMonthly] = useState(500)
  const [years, setYears] = useState(10)
  const [fxRate, setFxRate] = useState(1350)
  const [drip, setDrip] = useState(true)
  const [ticker, setTicker] = useState('SCHD')
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX)
  const [results, setResults] = useState<YearResult[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('simulator')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(10)

  useEffect(() => {
    fetch(`/api/etf-price?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => d.price && setLivePrice(d.price))
  }, [ticker])

  useEffect(() => {
    const etf = { ...ETF_DATA[ticker] }
    if (livePrice) etf.price = livePrice
    const res = simulate(etf, monthly * 10000, years, fxRate, drip, tax)
    setResults(res)
    setSelectedYear(Math.min(selectedYear, years))
  }, [monthly, years, fxRate, drip, ticker, livePrice, tax])

  const last = results[results.length - 1]
  const selectedResult = results.find(r => r.year === selectedYear) ?? last

  async function savePortfolio() {
    setSaving(true)
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${ticker} ${monthly}만원 × ${years}년`,
        settings: { monthlyKRW: monthly * 10000, years, fxRate, drip, etfs: [ticker], tax },
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <InstallPrompt />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">ETF 적립식 시뮬레이터</h1>
            <p className="text-slate-500 text-sm mt-1">
              {tax.enabled ? '🧾 세후 실수령액 기준' : '세전 기준'} · 배당 재투자(DRIP) 복리 분석
            </p>
          </div>
          <button onClick={savePortfolio} disabled={saving} className="btn-primary flex items-center gap-2">
            {saved ? '✓ 저장됨' : saving ? '저장 중...' : '💾 저장'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽 패널 */}
          <div className="space-y-4">
            {/* 탭 */}
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
              <div className="card p-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">ETF 선택</label>
                  <select className="input" value={ticker} onChange={e => setTicker(e.target.value)}>
                    {Object.keys(ETF_DATA).map(t => (
                      <option key={t} value={t}>{t} — {ETF_DATA[t].name}</option>
                    ))}
                  </select>
                  {livePrice && (
                    <p className="text-xs text-green-600 mt-1">🔴 실시간 ${livePrice.toFixed(2)}</p>
                  )}
                </div>

                <Slider label="월 투자금액" value={monthly} min={10} max={2000} step={10}
                  display={`${monthly.toLocaleString()}만원`} onChange={setMonthly} />
                <Slider label="투자 기간" value={years} min={1} max={30} step={1}
                  display={`${years}년`} onChange={setYears} />
                <Slider label="환율" value={fxRate} min={1000} max={1800} step={10}
                  display={`${fxRate.toLocaleString()}원`} onChange={setFxRate} />

                <div className="flex items-center gap-3">
                  <input type="checkbox" id="drip" checked={drip}
                    onChange={e => setDrip(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                  <label htmlFor="drip" className="text-sm cursor-pointer select-none">
                    배당 재투자 (DRIP) — 세후 배당금으로 재투자
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="card p-6">
                <TaxPanel tax={tax} onChange={setTax} />
              </div>
            )}

            {/* 세금 요약 — 연도 선택 */}
            {tax.enabled && selectedResult && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-slate-500">세금 상세 기준 연도</label>
                  <select className="input text-xs py-1 w-24"
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}>
                    {results.map(r => (
                      <option key={r.year} value={r.year}>{r.year}년차</option>
                    ))}
                  </select>
                </div>
                <TaxSummary result={selectedResult} taxEnabled={tax.enabled} />
              </div>
            )}
          </div>

          {/* 오른쪽 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 핵심 지표 4개 */}
            {last && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="총 투자원금" value={fmtKRW(last.invested)} />
                <StatCard label={`${years}년 후 포트폴리오`} value={fmtKRW(last.portfolioKRW)} color="blue" />
                <StatCard
                  label="세후 월 배당금"
                  value={fmtKRW(tax.enabled ? last.tax.afterTaxMonthlyDivKRW : last.monthlyDivKRW)}
                  color="amber"
                  badge={tax.enabled ? '세후' : undefined}
                />
                <StatCard
                  label="세후 실현 차익"
                  value={fmtKRW(tax.enabled ? last.tax.afterTaxGainKRW : last.gainKRW)}
                  color="green"
                  badge={tax.enabled ? '매도 시' : undefined}
                />
              </div>
            )}

            {/* 세전/세후 비교 배너 */}
            {tax.enabled && last && (
              <div className="bg-gradient-to-r from-blue-50 to-red-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-xs font-semibold text-slate-500 mb-3">세전 vs 세후 비교 ({years}년차)</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">세전 월 배당금</div>
                    <div className="text-lg font-bold text-slate-500 line-through decoration-red-400">
                      {fmtKRW(last.monthlyDivKRW)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">세후 월 배당금 💰</div>
                    <div className="text-lg font-bold text-blue-600">
                      {fmtKRW(last.tax.afterTaxMonthlyDivKRW)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">세전 차익</div>
                    <div className="text-lg font-bold text-slate-500 line-through decoration-red-400">
                      {fmtKRW(last.gainKRW)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-1">매도 후 세후 차익 💰</div>
                    <div className="text-lg font-bold text-green-600">
                      {fmtKRW(last.tax.afterTaxGainKRW)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 차트 */}
            <div className="card p-6">
              <h2 className="text-sm font-medium text-slate-500 mb-4">연도별 자산 성장</h2>
              <SimChart results={results} taxEnabled={tax.enabled} />
            </div>

            {/* 테이블 */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{minWidth: '480px'}}>
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['연도', '투자원금', '포트폴리오', '수익률',
                      tax.enabled ? '세후 월배당' : '월 배당금',
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
                      <td className="px-3 py-3 font-medium whitespace-nowrap">
                        {r.year}년차
                        {r.tax.exceedsThreshold && tax.enabled && (
                          <span className="ml-1 text-xs text-orange-500">⚠️</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{fmtKRW(r.invested)}</td>
                      <td className="px-3 py-3 font-medium whitespace-nowrap">{fmtKRW(r.portfolioKRW)}</td>
                      <td className={`px-3 py-3 font-medium whitespace-nowrap ${r.gainPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        +{r.gainPct.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-amber-600 font-medium whitespace-nowrap">
                        {fmtKRW(tax.enabled ? r.tax.afterTaxMonthlyDivKRW : r.monthlyDivKRW)}
                      </td>
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
                  ⚠️ 표시된 행은 금융소득 종합과세 대상 (2,000만원 초과) · 행 클릭 시 세금 상세 확인
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

function Slider({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
    </div>
  )
}

function StatCard({ label, value, color, badge }: {
  label: string; value: string; color?: string; badge?: string
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1 mb-1">
        <div className="text-xs text-slate-500 truncate">{label}</div>
        {badge && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">{badge}</span>}
      </div>
      <div className={`text-lg font-bold ${color ? colors[color] : 'text-slate-800'}`}>{value}</div>
    </div>
  )
}
