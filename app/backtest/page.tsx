'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  BarChart, Bar, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { HISTORICAL_RETURNS, runBacktest, calcMDD } from '@/lib/historicalReturns'
import { usePersistedState } from '@/lib/usePersistedState'

const ETF_INFO: Record<string, { color: string; desc: string }> = {
  QQQ: { color: '#8b5cf6', desc: 'NASDAQ-100 · 2000~' },
  VOO: { color: '#10b981', desc: 'S&P 500 · 2011~' },
  SCHD: { color: '#0ea5e9', desc: '배당성장 · 2012~' },
}

const ETF_MIN_YEAR: Record<string, number> = { QQQ: 2000, VOO: 2011, SCHD: 2012 }
const MAX_YEAR = 2024

function fmtBillion(wan: number): string {
  if (wan >= 10000) return `${(wan / 10000).toFixed(1)}억`
  return `${Math.round(wan).toLocaleString()}만`
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export default function BacktestPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [ticker, setTicker] = usePersistedState<string>('bt_ticker', 'QQQ')
  const [startYear, setStartYear] = usePersistedState<number>('bt_startYear', 2010)
  const [endYear]  = useState(MAX_YEAR)
  const [monthly, setMonthly] = usePersistedState<number>('bt_monthly', 30)

  const minYear = ETF_MIN_YEAR[ticker] ?? 2000
  const clampedStart = Math.max(startYear, minYear)

  const rows = useMemo(
    () => runBacktest(ticker, clampedStart, endYear, monthly),
    [ticker, clampedStart, endYear, monthly],
  )

  const stats = useMemo(() => {
    if (rows.length === 0) return null
    const last = rows[rows.length - 1]
    const totalInvested = last.invested
    const finalBalance  = last.balance
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

  const chartColor = ETF_INFO[ticker]?.color ?? '#1d4ed8'

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-5">

        <div className="mb-4">
          <h1 className="text-base sm:text-lg font-bold text-slate-800">백테스트 — 역사적 수익률 시뮬레이션</h1>
          <p className="text-xs text-slate-500 mt-0.5">실제 연간 총수익률(배당 포함)을 기반으로 DCA 투자 결과를 시뮬레이션합니다.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* ── 입력 패널 ── */}
          <div className="space-y-4 lg:col-span-1">

            {/* ETF 선택 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3">ETF 선택</div>
              <div className="space-y-2">
                {Object.entries(ETF_INFO).map(([t, info]) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTicker(t)
                      if (startYear < ETF_MIN_YEAR[t]) setStartYear(ETF_MIN_YEAR[t])
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      ticker === t
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: info.color }} />
                    <div>
                      <div className={`text-sm font-semibold ${ticker === t ? 'text-blue-700' : 'text-slate-700'}`}>{t}</div>
                      <div className="text-xs text-slate-400">{info.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 투자 기간 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-1">투자 시작 연도</div>
              <div className="text-2xl font-bold text-slate-800 mb-1">{clampedStart}년</div>
              <input
                type="range"
                min={minYear}
                max={MAX_YEAR - 1}
                step={1}
                value={clampedStart}
                onChange={e => setStartYear(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{minYear}</span>
                <span>~ {MAX_YEAR - 1}</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                투자 기간: <span className="font-semibold text-slate-700">{rows.length}년</span>
                <span className="text-slate-400"> ({clampedStart} ~ {MAX_YEAR})</span>
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

            {/* 통계 카드 */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">투자 원금</div>
                  <div className="text-lg font-bold text-slate-800">{fmtBillion(stats.totalInvested)}</div>
                </div>
                <div className="card p-3 sm:p-4">
                  <div className="text-xs text-slate-400 mb-1">최종 잔액</div>
                  <div className="text-lg font-bold" style={{ color: chartColor }}>{fmtBillion(stats.finalBalance)}</div>
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

            {/* 연간 수익률 바 차트 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-1">연간 수익률 (%)</div>
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

            {/* 잔액 성장 라인 차트 */}
            <div className="card p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3">잔액 성장 (DCA {monthly}만원/월)</div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={rows.length > 10 ? Math.floor(rows.length / 8) : 0} />
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
                  <Line type="monotone" dataKey="invested"
                    name="투자 원금" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="balance"
                    name="평가 잔액" stroke={chartColor} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 연도별 상세 테이블 */}
            <div className="card overflow-hidden">
              <div className="px-4 pt-4 pb-1 text-sm font-semibold text-slate-700">연도별 상세</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '360px' }}>
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-3 py-2.5 font-medium text-slate-500">연도</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">연간 수익률</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">투자 원금</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">평가 잔액</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">손익</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map(row => (
                      <tr key={row.year} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-700">{row.year}년</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${row.returnPct >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          {fmtPct(row.returnPct)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-500">{fmtBillion(row.invested)}원</td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-800">{fmtBillion(row.balance)}원</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${row.gainLoss >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.gainLoss >= 0 ? '+' : ''}{fmtBillion(row.gainLoss)}원
                        </td>
                      </tr>
                    ))}
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
