'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import CompareChart from '@/components/charts/CompareChart'
import { ETF_DATA, simulate, fmtKRW } from '@/lib/simulator'
import { YearResult } from '@/types'

const ALL_TICKERS = Object.keys(ETF_DATA)

export default function ComparePage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [selected, setSelected] = useState<string[]>(['SCHD', 'VOO', 'QQQ'])
  const [monthly, setMonthly] = useState(500)
  const [years, setYears] = useState(10)
  const [fxRate, setFxRate] = useState(1350)
  const [drip, setDrip] = useState(true)
  const [compareResults, setCompareResults] = useState<Record<string, YearResult[]>>({})

  // 실시간 환율
  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) setFxRate(d.rate)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const res: Record<string, YearResult[]> = {}
    selected.forEach(t => {
      res[t] = simulate(ETF_DATA[t], monthly * 10000, years, fxRate, drip)
    })
    setCompareResults(res)
  }, [selected, monthly, years, fxRate, drip])

  function toggleTicker(t: string) {
    setSelected(prev =>
      prev.includes(t)
        ? prev.length > 1 ? prev.filter(x => x !== t) : prev
        : [...prev, t]
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-4">

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Controls */}
          <div className="card p-6 space-y-5 h-fit">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">ETF 선택 (최대 5개)</label>
              <div className="space-y-2">
                {ALL_TICKERS.map(t => {
                  const etf = ETF_DATA[t]
                  const active = selected.includes(t)
                  return (
                    <button key={t} onClick={() => toggleTicker(t)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${
                        active
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}>
                      <div className="font-semibold">{t}</div>
                      <div className="text-xs opacity-70 truncate">{etf.name}</div>
                      <div className="flex gap-3 mt-1 text-xs">
                        <span>배당 {etf.divYield}%</span>
                        <span>주가↑ {etf.priceCAGR}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <SliderField label="월 투자금액" value={monthly} min={10} max={2000} step={10}
                display={`${monthly.toLocaleString()}만원`} onChange={setMonthly} />
              <SliderField label="투자 기간" value={years} min={1} max={30} step={1}
                display={`${years}년`} onChange={setYears} />
              <SliderField label="환율" value={fxRate} min={1000} max={1800} step={10}
                display={`${fxRate.toLocaleString()}원`} onChange={setFxRate} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="drip2" checked={drip}
                  onChange={e => setDrip(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                <label htmlFor="drip2" className="text-sm cursor-pointer">배당 재투자 (DRIP)</label>
              </div>
            </div>
          </div>

          {/* Charts & Table */}
          <div className="lg:col-span-3 space-y-6">
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
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-medium text-slate-700">ETF 기본 정보 비교</h2>
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
                    return (
                      <tr key={t} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: etf.color }} />
                            <span className="font-semibold">{t}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">${etf.price.toFixed(2)}</td>
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

function SliderField({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm text-slate-600">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
    </div>
  )
}
