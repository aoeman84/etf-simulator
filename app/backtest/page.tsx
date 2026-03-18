'use client'
import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  BarChart, Bar, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { runBacktest, calcMDD } from '@/lib/historicalReturns'
import { usePersistedState } from '@/lib/usePersistedState'

const ETF_INFO: Record<string, { color: string; desc: string }> = {
  QQQ:  { color: '#7c3aed', desc: 'NASDAQ-100 · 2000~' },
  VOO:  { color: '#0891b2', desc: 'S&P 500 · 2011~' },
  SCHD: { color: '#2563eb', desc: '배당성장 · 2012~' },
  VYM:  { color: '#059669', desc: '고배당 · 2007~' },
  JEPI: { color: '#dc2626', desc: '커버드콜 · 2020~' },
}

const ETF_MIN_YEAR: Record<string, number> = {
  QQQ: 2000, VOO: 2011, SCHD: 2012, VYM: 2007, JEPI: 2020,
}
const MAX_YEAR = 2024
const GLOBAL_MIN_YEAR = Math.min(...Object.values(ETF_MIN_YEAR))

function fmtBillion(wan: number): string {
  if (Math.abs(wan) >= 10000) return `${(wan / 10000).toFixed(1)}억`
  return `${Math.round(wan).toLocaleString()}만`
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export default function BacktestPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [selectedTickers, setSelectedTickers] = usePersistedState<string[]>('bt_tickers', ['QQQ'])
  const [startYear, setStartYear] = usePersistedState<number>('bt_startYear', 2010)
  const [monthly, setMonthly] = usePersistedState<number>('bt_monthly', 30)

  // 선택된 ETF 중 가장 늦은 시작연도에 맞춰 공통 시작연도 결정 (공정 비교)
  const minYearOfSelected = Math.max(...selectedTickers.map(t => ETF_MIN_YEAR[t] ?? GLOBAL_MIN_YEAR))
  const effectiveStart = Math.max(startYear, minYearOfSelected)

  function toggleTicker(t: string) {
    setSelectedTickers(prev => {
      if (prev.includes(t)) {
        if (prev.length === 1) return prev  // 최소 1개 유지
        return prev.filter(x => x !== t)
      }
      if (prev.length >= 3) return prev  // 최대 3개
      return [...prev, t]
    })
  }

  // 각 ticker별 backtest rows (공통 시작연도 기준)
  const allRows = useMemo(() => {
    const result: Record<string, ReturnType<typeof runBacktest>> = {}
    for (const t of selectedTickers) {
      result[t] = runBacktest(t, effectiveStart, MAX_YEAR, monthly)
    }
    return result
  }, [selectedTickers, effectiveStart, monthly])

  const primaryTicker = selectedTickers[0] ?? 'QQQ'
  const rows = allRows[primaryTicker] ?? []

  // 통계 (1번째 ETF 기준)
  const stats = useMemo(() => {
    if (rows.length === 0) return null
    const last = rows[rows.length - 1]
    const totalInvested = last.invested
    const finalBalance = last.balance
    const totalReturnPct = totalInvested > 0 ? (finalBalance - totalInvested) / totalInvested * 100 : 0
    const years = rows.length
    const cagrPct = years > 0 ? (Math.pow(finalBalance / totalInvested, 1 / years) - 1) * 100 : 0
    const mdd = calcMDD(rows)
    const positiveYears = rows.filter(r => r.returnPct > 0).length
    const negativeYears = rows.filter(r => r.returnPct < 0).length
    const avgReturn = rows.reduce((s, r) => s + r.returnPct, 0) / rows.length
    const bestYear  = rows.reduce((a, b) => b.returnPct > a.returnPct ? b : a)
    const worstYear = rows.reduce((a, b) => b.returnPct < a.returnPct ? b : a)
    return { totalInvested, finalBalance, totalReturnPct, cagrPct, mdd, positiveYears, negativeYears, avgReturn, bestYear, worstYear, years }
  }, [rows])

  // 잔액 성장 차트 데이터 — 선택된 모든 ETF + 투자원금
  const balanceChartData = useMemo(() => {
    const yearSet = new Set<number>()
    for (const r of Object.values(allRows)) r.forEach(row => yearSet.add(row.year))
    const years = [...yearSet].sort((a, b) => a - b)
    return years.map(year => {
      const point: Record<string, number | null> = { year }
      // 투자원금은 primary 기준 (모두 같은 monthly)
      const pRow = allRows[primaryTicker]?.find(r => r.year === year)
      point['투자원금'] = pRow?.invested ?? null
      for (const t of selectedTickers) {
        const row = allRows[t]?.find(r => r.year === year)
        point[t] = row?.balance ?? null
      }
      return point
    })
  }, [allRows, selectedTickers, primaryTicker])

  const primaryColor = ETF_INFO[primaryTicker]?.color ?? '#1d4ed8'

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <p className="text-xs text-slate-500 bg-white border-b border-slate-100 px-4 py-2">💡 역사적 수익률 시뮬레이션 · 실제 연간 총수익률 기반 DCA 투자 결과를 확인합니다</p>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-5">

        <div className="mb-4">
          <h1 className="text-base sm:text-lg font-bold text-slate-800">백테스트 — 역사적 수익률 시뮬레이션</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* ── 입력 패널 ── */}
          <div className="space-y-4 lg:col-span-1">

            {/* ETF 선택 (복수, 최대 3개) */}
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-700">ETF 선택</div>
                <div className="text-xs text-slate-400">최대 3개</div>
              </div>
              <div className="space-y-2">
                {Object.entries(ETF_INFO).map(([t, info]) => {
                  const checked = selectedTickers.includes(t)
                  const disabled = !checked && selectedTickers.length >= 3
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTicker(t)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        checked
                          ? 'border-blue-300 bg-blue-50'
                          : disabled
                            ? 'border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed'
                            : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {/* 체크 표시 */}
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                        checked ? 'border-blue-400 bg-blue-500' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>}
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: info.color }} />
                      <div>
                        <div className={`text-sm font-semibold ${checked ? 'text-blue-700' : 'text-slate-700'}`}>{t}</div>
                        <div className="text-xs text-slate-400">{info.desc}</div>
                      </div>
                      {checked && selectedTickers[0] === t && (
                        <span className="ml-auto text-xs text-blue-400 font-medium">기준</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 mt-2.5">
                첫 번째 선택 ETF가 통계·바 차트 기준입니다.
              </p>
            </div>

            {/* 투자 시작 연도 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-1">투자 시작 연도</div>
              <div className="text-2xl font-bold text-slate-800 mb-1">{effectiveStart}년</div>
              {effectiveStart > startYear && (
                <div className="text-xs text-amber-600 mb-1">
                  선택 ETF 데이터 시작: {minYearOfSelected}년
                </div>
              )}
              <input
                type="range"
                min={GLOBAL_MIN_YEAR}
                max={MAX_YEAR - 1}
                step={1}
                value={startYear}
                onChange={e => setStartYear(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{GLOBAL_MIN_YEAR}</span>
                <span>~ {MAX_YEAR - 1}</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                투자 기간: <span className="font-semibold text-slate-700">{rows.length}년</span>
                <span className="text-slate-400"> ({effectiveStart} ~ {MAX_YEAR})</span>
              </div>
            </div>

            {/* 월 납입액 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-1">월 납입액</div>
              <div className="text-2xl font-bold text-slate-800 mb-1">{monthly}만원</div>
              <input
                type="range"
                min={10}
                max={300}
                step={10}
                value={monthly}
                onChange={e => setMonthly(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>10만</span>
                <span>300만</span>
              </div>
            </div>

          </div>

          {/* ── 결과 패널 ── */}
          <div className="space-y-4 lg:col-span-3">

            {/* 통계 카드 (primaryTicker 기준) */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">투자 원금</div>
                  <div className="text-lg font-bold text-slate-800">{fmtBillion(stats.totalInvested)}</div>
                </div>
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">최종 잔액 <span className="font-normal">({primaryTicker})</span></div>
                  <div className="text-lg font-bold" style={{ color: primaryColor }}>{fmtBillion(stats.finalBalance)}</div>
                </div>
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">총 수익률</div>
                  <div className={`text-lg font-bold ${stats.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtPct(stats.totalReturnPct)}
                  </div>
                </div>
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">연평균 수익률 (CAGR)</div>
                  <div className={`text-lg font-bold ${stats.cagrPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtPct(stats.cagrPct)}
                  </div>
                </div>
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">최대 낙폭 (MDD)</div>
                  <div className="text-lg font-bold text-red-500">{fmtPct(stats.mdd)}</div>
                </div>
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">수익 / 손실 연도</div>
                  <div className="text-lg font-bold text-slate-800">
                    <span className="text-green-600">{stats.positiveYears}승</span>
                    {' / '}
                    <span className="text-red-500">{stats.negativeYears}패</span>
                  </div>
                </div>
              </div>
            )}

            {/* 연간 수익률 바 차트 (primaryTicker 기준) */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-1">
                연간 수익률 (%) — {primaryTicker} 기준
              </div>
              {stats && (
                <div className="text-xs text-slate-400 mb-3">
                  평균 {fmtPct(stats.avgReturn)} · 최고 {stats.bestYear.year}년 {fmtPct(stats.bestYear.returnPct)} · 최저 {stats.worstYear.year}년 {fmtPct(stats.worstYear.returnPct)}
                </div>
              )}
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={rows.length > 10 ? Math.floor(rows.length / 8) : 0} />
                  <YAxis
                    tickFormatter={v => `${v}%`}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    domain={['auto', 'auto']}
                    tickCount={5}
                  />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1.5} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, '연간 수익률']}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="returnPct" radius={[2, 2, 0, 0]}>
                    {rows.map(row => (
                      <Cell key={row.year} fill={row.returnPct >= 0 ? '#3b82f6' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 잔액 성장 차트 — 선택된 모든 ETF 동시 표시 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3">
                잔액 성장 비교 (DCA {monthly}만원/월)
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={balanceChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={balanceChartData.length > 10 ? Math.floor(balanceChartData.length / 8) : 0} />
                  <YAxis
                    tickFormatter={v => fmtBillion(v)}
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickCount={5}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmtBillion(v) + '원', name]}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line
                    type="monotone"
                    dataKey="투자원금"
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="4 2"
                    connectNulls={false}
                  />
                  {selectedTickers.map(t => (
                    <Line
                      key={t}
                      type="monotone"
                      dataKey={t}
                      name={t}
                      stroke={ETF_INFO[t]?.color ?? '#1d4ed8'}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 연도별 상세 테이블 (primaryTicker 기준) */}
            <div className="card overflow-hidden">
              <div className="px-4 pt-4 pb-1 flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-700">연도별 상세</div>
                <div className="flex gap-1.5">
                  {selectedTickers.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                      style={{ background: ETF_INFO[t]?.color }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: `${300 + selectedTickers.length * 80}px` }}>
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium text-slate-500">연도</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">수익률({primaryTicker})</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">투자원금</th>
                      {selectedTickers.map(t => (
                        <th key={t} className="text-right px-3 py-2.5 font-medium whitespace-nowrap"
                          style={{ color: ETF_INFO[t]?.color }}>
                          {t} 잔액
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {balanceChartData.map(row => {
                      const primaryRow = allRows[primaryTicker]?.find(r => r.year === row.year)
                      return (
                        <tr key={row.year} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-700">{row.year}년</td>
                          <td className={`px-3 py-2.5 text-right font-semibold ${
                            primaryRow && primaryRow.returnPct >= 0 ? 'text-blue-600' : 'text-red-500'
                          }`}>
                            {primaryRow ? fmtPct(primaryRow.returnPct) : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500">
                            {row['투자원금'] != null ? fmtBillion(row['투자원금'] as number) + '원' : '-'}
                          </td>
                          {selectedTickers.map(t => {
                            const val = row[t] as number | null
                            return (
                              <td key={t} className="px-3 py-2.5 text-right font-medium text-slate-800 whitespace-nowrap">
                                {val != null ? fmtBillion(val) + '원' : '-'}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center px-2">
              ※ 본 백테스트는 실제 연간 총수익률(배당 재투자 포함) 기반 시뮬레이션입니다. 환율·세금·수수료 미반영. 과거 수익률이 미래 성과를 보장하지 않습니다.
            </p>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
