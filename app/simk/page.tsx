'use client'
import { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ScenarioModal, { ScenarioSettings } from '@/components/ScenarioModal'
import { fmtKRW, ETF_DATA } from '@/lib/simulator'
import { usePersistedState } from '@/lib/usePersistedState'
import { simulateK, SimKYearRow, EtfAlloc, AccountAllocations } from '@/lib/simulatorK'

const DEFAULT_SCENARIO: ScenarioSettings = {
  mode: 'optimistic',
  priceCAGRAdj: 0,
  divGrowthAdj: 0,
  inflationRate: 2.5,
}

const SIMK_TICKERS = ['SCHD', 'VOO', 'QQQ']

const DEFAULT_ALLOCATIONS: AccountAllocations = {
  isa:     SIMK_TICKERS.map((t, i) => ({ ticker: t, pct: i === 0 ? 100 : 0 })),
  pension: SIMK_TICKERS.map((t, i) => ({ ticker: t, pct: i === 0 ? 100 : 0 })),
  irp:     SIMK_TICKERS.map((t, i) => ({ ticker: t, pct: i === 0 ? 100 : 0 })),
}

function singleTickerAlloc(ticker: string): AccountAllocations {
  const alloc = SIMK_TICKERS.map(t => ({ ticker: t, pct: t === ticker ? 100 : 0 }))
  return { isa: alloc, pension: [...alloc], irp: [...alloc] }
}

function allocSum(allocs: EtfAlloc[]) {
  return allocs.reduce((s, a) => s + a.pct, 0)
}

function fmt(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  return `${Math.round(n / 1e4)}만`
}

export default function SimKPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [mode, setMode] = usePersistedState<'monthly' | 'annual'>('simk_mode', 'monthly')
  const [totalMonthly, setTotalMonthly] = usePersistedState<number>('simk_totalMonthly', 100)  // 만원
  const [isaAnnual, setIsaAnnual] = usePersistedState<number>('simk_isaAnnual', 816)           // 만원
  const [pensionAnnual, setPensionAnnual] = usePersistedState<number>('simk_pensionAnnual', 240)
  const [irpAnnual, setIrpAnnual] = usePersistedState<number>('simk_irpAnnual', 144)
  const [allocations, setAllocations] = usePersistedState<AccountAllocations>('simk_allocations', DEFAULT_ALLOCATIONS)
  const [taxCreditRate, setTaxCreditRate] = usePersistedState<number>('simk_taxRate', 0.132)
  const [currentAge, setCurrentAge] = usePersistedState<number>('simk_currentAge', 35)
  const [retirementAge, setRetirementAge] = usePersistedState<number>('simk_retirementAge', 65)
  const [reinvestRefund, setReinvestRefund] = usePersistedState<boolean>('simk_reinvest', false)
  const [scenario, setScenario] = usePersistedState<ScenarioSettings>('simk_scenario', DEFAULT_SCENARIO)

  function updateAlloc(account: keyof AccountAllocations, ticker: string, pct: number) {
    setAllocations(prev => ({
      ...prev,
      [account]: prev[account].map(a => a.ticker === ticker ? { ...a, pct: Math.max(0, Math.min(100, pct)) } : a),
    }))
  }

  const isaValid     = allocSum(allocations.isa) === 100
  const pensionValid = allocSum(allocations.pension) === 100
  const irpValid     = allocSum(allocations.irp) === 100
  const allocValid   = isaValid && pensionValid && irpValid

  const baseParams = useMemo(() => ({
    mode,
    totalMonthlyWan: totalMonthly,
    isaAnnualWan: isaAnnual,
    pensionAnnualWan: pensionAnnual,
    irpAnnualWan: irpAnnual,
    taxCreditRate,
    currentAge,
    retirementAge,
    reinvestRefund,
    scenario,
  }), [mode, totalMonthly, isaAnnual, pensionAnnual, irpAnnual,
      taxCreditRate, currentAge, retirementAge, reinvestRefund, scenario])

  // 내 포트폴리오 시뮬레이션
  const primary = useMemo(() => {
    if (!allocValid) return null
    return simulateK({ ...baseParams, accountAllocations: allocations })
  }, [baseParams, allocations, allocValid])

  // 단일 ETF 100% 비교 시뮬레이션
  const comparisonResults = useMemo(() => {
    return SIMK_TICKERS.map(ticker => ({
      ticker,
      result: simulateK({ ...baseParams, accountAllocations: singleTickerAlloc(ticker) }),
    }))
  }, [baseParams])

  // 차트 데이터
  const chartData = useMemo(() => {
    if (!primary) return []
    return primary.rows.map(row => ({
      label: `${row.age}세 (${row.year}년)`,
      '내 포트폴리오': Math.round(row.totalBalance / 1e4),
      '일반 계좌': Math.round(row.normalBalance / 1e4),
    }))
  }, [primary])

  // ScenarioModal에 전달할 활성 티커
  const activeTickers = useMemo(() => {
    const all = [...allocations.isa, ...allocations.pension, ...allocations.irp]
    return [...new Set(all.filter(a => a.pct > 0).map(a => a.ticker))]
  }, [allocations])

  const years = Math.max(1, retirementAge - currentAge)
  const pensionWarning = primary ? (primary.finalBalance / 20 / 12) > 12_000_000 : false

  // 연간 납입액 표시
  const annualISA     = mode === 'monthly' ? Math.min(totalMonthly * 12 * 0.68, 2000) : Math.min(isaAnnual, 2000)
  const annualPension = mode === 'monthly' ? Math.min(totalMonthly * 12 * 0.20, 1500) : Math.min(pensionAnnual, 1500)
  const annualIRP     = mode === 'monthly' ? Math.min(totalMonthly * 12 * 0.12, 300)  : Math.min(irpAnnual, 300)

  const tickerColors: Record<string, string> = {
    SCHD: '#2563eb',
    VOO:  '#16a34a',
    QQQ:  '#9333ea',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar titleSlot={<ScenarioModal scenario={scenario} onChange={setScenario} selectedTickers={activeTickers} />} />

      <main className="max-w-6xl mx-auto px-4 py-4">
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-800">Sim K — 절세 계좌 시뮬레이터</h1>
          <p className="text-xs text-slate-500 mt-0.5">ISA + 연금저축 + IRP 절세 계좌를 활용했을 때 절세 효과를 시뮬레이션합니다.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── 왼쪽 패널 ── */}
          <div className="space-y-4">

            {/* 납입 방식 */}
            <div className="card p-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-2">납입 방식</label>
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  {(['monthly', 'annual'] as const).map(m => (
                    <button key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 text-xs py-2 px-2 rounded-lg font-medium transition-all ${
                        mode === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
                      }`}>
                      {m === 'monthly' ? '월 적립' : '연초 일시납'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 납입 금액 */}
              {mode === 'monthly' ? (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-slate-700">총 월 납입액</label>
                    <span className="text-sm font-semibold text-blue-600">{totalMonthly}만원/월</span>
                  </div>
                  <input type="range" min={10} max={245} step={5}
                    value={totalMonthly}
                    onChange={e => setTotalMonthly(Number(e.target.value))}
                    className="w-full accent-blue-600" />
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5 bg-slate-50 rounded-xl p-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">ISA (68%)</span>
                      <span>{Math.round(annualISA)}만원/년</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">연금저축 (20%)</span>
                      <span>{Math.round(annualPension)}만원/년</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IRP (12%)</span>
                      <span>{Math.round(annualIRP)}만원/년</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <AccountInput label="ISA" value={isaAnnual} max={2000} step={100} onChange={setIsaAnnual}
                    sub="max 2,000만원/년" />
                  <AccountInput label="연금저축" value={pensionAnnual} max={1500} step={100} onChange={setPensionAnnual}
                    sub="세액공제 600만원까지" />
                  <AccountInput label="IRP" value={irpAnnual} max={300} step={50} onChange={setIrpAnnual}
                    sub="max 300만원/년" />
                </div>
              )}

              {/* 세액공제율 */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">세액공제율</label>
                <div className="flex gap-2">
                  {[
                    { rate: 0.132, label: '13.2%', sub: '총급여 5,500만원 초과' },
                    { rate: 0.165, label: '16.5%', sub: '총급여 5,500만원 이하' },
                  ].map(({ rate, label, sub }) => (
                    <button key={rate}
                      onClick={() => setTaxCreditRate(rate)}
                      className={`flex-1 text-left p-2.5 rounded-xl border transition-all text-xs ${
                        taxCreditRate === rate
                          ? 'border-blue-400 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}>
                      <div className="font-semibold">{label}</div>
                      <div className="text-slate-400 mt-0.5 leading-tight">{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 나이 슬라이더 */}
              <div className="space-y-3">
                <SliderRow label="현재 나이" value={currentAge} min={20} max={60} step={1}
                  display={`${currentAge}세`} onChange={setCurrentAge} />
                <SliderRow label="연금 수령 나이" value={retirementAge} min={55} max={80} step={1}
                  display={`${retirementAge}세`} onChange={setRetirementAge} />
                <div className="text-xs text-slate-400 text-center">
                  납입 기간: <span className="font-semibold text-slate-600">{years}년</span>
                </div>
              </div>

              {/* 세액공제 환급금 재투자 */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="reinvest" checked={reinvestRefund}
                  onChange={e => setReinvestRefund(e.target.checked)}
                  className="w-4 h-4 accent-blue-600" />
                <label htmlFor="reinvest" className="text-sm cursor-pointer select-none">
                  세액공제 환급금 연금저축에 재투자
                </label>
              </div>
            </div>

            {/* 계좌별 ETF 배분 */}
            <div className="card p-4 space-y-4">
              <div className="text-sm font-semibold text-slate-700">계좌별 ETF 배분</div>
              {(
                [
                  { key: 'isa' as const,     label: 'ISA',     color: 'text-blue-600',   valid: isaValid },
                  { key: 'pension' as const, label: '연금저축', color: 'text-green-600',  valid: pensionValid },
                  { key: 'irp' as const,     label: 'IRP',     color: 'text-purple-600', valid: irpValid },
                ]
              ).map(({ key, label, color, valid }) => {
                const sum = allocSum(allocations[key])
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-semibold ${color}`}>{label}</span>
                      <span className={`text-xs font-medium ${valid ? 'text-green-600' : 'text-red-500'}`}>
                        합계: {sum}% {valid ? '✓' : '⚠'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {allocations[key].map(({ ticker, pct }) => (
                        <div key={ticker} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: tickerColors[ticker] }} />
                          <span className="text-xs font-medium text-slate-600 w-10 flex-shrink-0">{ticker}</span>
                          <input
                            type="range" min={0} max={100} step={5}
                            value={pct}
                            onChange={e => updateAlloc(key, ticker, Number(e.target.value))}
                            className="flex-1 accent-blue-600"
                            style={{ accentColor: tickerColors[ticker] }}
                          />
                          <span className="text-xs font-semibold text-slate-700 w-9 text-right">{pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {!allocValid && (
                <div className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  각 계좌의 ETF 비율 합계가 100%가 되어야 합니다.
                </div>
              )}
            </div>

            {/* 계좌 한도 안내 */}
            <div className="card p-4">
              <div className="text-xs font-semibold text-slate-600 mb-3">계좌별 규칙 요약</div>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex gap-2">
                  <span className="w-20 font-semibold text-blue-600 flex-shrink-0">ISA</span>
                  <span>연 2,000만원 · 3년 의무보유 · 비과세 200만원 · 초과 9.9% · 만기시 연금저축 이체</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-20 font-semibold text-green-600 flex-shrink-0">연금저축</span>
                  <span>연 1,500만원 · 세액공제 600만원 기준 · 수령시 연금소득세</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-20 font-semibold text-purple-600 flex-shrink-0">IRP</span>
                  <span>연 300만원 · 연금저축+합산 900만원까지 세액공제 · 수령시 연금소득세</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 오른쪽 ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* 핵심 지표 카드 */}
            {primary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="총 납입원금" value={fmtKRW(primary.totalContributed)} />
                <StatCard label="절세 계좌 최종 잔액" value={fmtKRW(primary.finalBalance)}
                  color="blue" sub={`${retirementAge}세 기준`} />
                <StatCard label="일반 계좌 대비 절세 효과"
                  value={primary.taxAdvantage >= 0
                    ? `+${fmtKRW(primary.taxAdvantage)}`
                    : fmtKRW(primary.taxAdvantage)}
                  color={primary.taxAdvantage >= 0 ? 'green' : undefined}
                  sub="세후 양도차익 기준" />
                <StatCard label="예상 월 연금 수령액"
                  value={fmtKRW(primary.monthlyPension)}
                  color="amber"
                  sub={`연금소득세 ${(primary.pensionTaxRate * 100).toFixed(1)}% 후`}
                  warn={pensionWarning} />
              </div>
            )}

            {!allocValid && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-orange-700">
                ⚠️ 계좌별 ETF 비율 합계를 100%로 맞춰야 시뮬레이션 결과가 표시됩니다.
              </div>
            )}

            {pensionWarning && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-orange-700">
                ⚠️ 연간 수령액이 1,200만원을 초과할 수 있습니다. 종합과세 대상이 될 수 있으니 분산 수령을 검토하세요.
              </div>
            )}

            {/* 포트폴리오 vs 단일 ETF 비교 표 */}
            <div className="card overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="text-sm font-semibold text-slate-700">포트폴리오 절세 효과 비교</div>
                <div className="text-xs text-slate-400 mt-0.5">동일 납입 조건 · {retirementAge}세 기준</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '480px' }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500">구성</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">세액공제 누적</th>
                      <th className="text-right px-3 py-2.5 font-medium text-slate-500">절세 계좌 잔액</th>
                      <th className="text-right px-4 py-2.5 font-medium text-slate-500">일반 대비 이득</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* 내 포트폴리오 */}
                    <tr className="bg-blue-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-blue-700">내 포트폴리오</div>
                        <div className="text-slate-400 mt-0.5 leading-tight">
                          {['isa', 'pension', 'irp'].map((acct) => {
                            const alloc = allocations[acct as keyof AccountAllocations]
                            const active = alloc.filter(a => a.pct > 0)
                            if (active.length === 0) return null
                            const label = acct === 'isa' ? 'ISA' : acct === 'pension' ? '연금' : 'IRP'
                            return (
                              <span key={acct} className="mr-2">
                                {label}: {active.map(a => `${a.ticker} ${a.pct}%`).join('+')}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-blue-600">
                        {primary ? fmtKRW(primary.totalTaxCredit) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800">
                        {primary ? fmtKRW(primary.finalBalance) : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        primary && primary.taxAdvantage >= 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {primary
                          ? `${primary.taxAdvantage >= 0 ? '+' : ''}${fmtKRW(primary.taxAdvantage)}`
                          : '-'}
                      </td>
                    </tr>
                    {/* 단일 ETF 100% 비교 */}
                    {comparisonResults.map(({ ticker, result }) => (
                      <tr key={ticker} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: tickerColors[ticker] }} />
                            <span className="font-semibold text-slate-700">{ticker} 100%</span>
                            <span className="text-slate-400">배당 {ETF_DATA[ticker].divYield}% / CAGR {ETF_DATA[ticker].priceCAGR}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-blue-600">
                          {fmtKRW(result.totalTaxCredit)}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-800">
                          {fmtKRW(result.finalBalance)}
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${
                          result.taxAdvantage >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {result.taxAdvantage >= 0 ? '+' : ''}{fmtKRW(result.taxAdvantage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 비교 차트 */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">절세 계좌 vs 일반 계좌 비교</h2>
                  <p className="text-xs text-slate-400 mt-0.5">일반 계좌: 배당 15.4% 원천징수 · 매도 시 양도세 22% 적용</p>
                </div>
                <ScenarioModal scenario={scenario} onChange={setScenario} selectedTickers={activeTickers} />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }}
                    interval={Math.max(0, Math.floor(years / 6) - 1)} />
                  <YAxis tickFormatter={v => fmt(v * 1e4)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmt(v * 1e4) + '원', name]}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="내 포트폴리오"
                    stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="일반 계좌"
                    stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 연도별 테이블 */}
            {primary && (
              <div className="card overflow-hidden">
                <div className="px-4 pt-4 pb-1">
                  <div className="text-sm font-semibold text-slate-700">연도별 잔액 (내 포트폴리오 기준)</div>
                </div>
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' as any }}>
                  <table className="w-full text-xs" style={{ minWidth: '620px' }}>
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap sticky left-0 bg-slate-50 z-10">연도/나이</th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">ISA 잔액</th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">연금저축</th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">IRP</th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">세액공제 환급</th>
                        <th className="text-right px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">누적 절세</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {primary.rows.map((row: SimKYearRow) => (
                        <tr key={row.year} className={`hover:bg-slate-50 ${row.isaTransfer > 0 ? 'bg-blue-50' : ''}`}>
                          <td className="px-3 py-2.5 font-medium whitespace-nowrap sticky left-0 bg-white z-10"
                            style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                            {row.year}년차
                            <span className="text-slate-400 ml-1">({row.age}세)</span>
                            {row.isaTransfer > 0 && <span className="ml-1 text-blue-500 font-bold">↗ ISA 만기</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-blue-600 whitespace-nowrap">
                            {fmtKRW(row.isaBalance)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-green-600 whitespace-nowrap">
                            {fmtKRW(row.pensionBalance)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-purple-600 whitespace-nowrap">
                            {fmtKRW(row.irpBalance)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-amber-600 font-medium whitespace-nowrap">
                            +{fmtKRW(row.taxCreditThisYear)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                            {fmtKRW(row.cumulativeTaxCredit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 text-xs text-blue-600">
                  ↗ ISA 만기 행: ISA 만기 해지 후 연금저축 이체 + 추가 세액공제 발생
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function AccountInput({ label, value, max, step = 100, onChange, sub }: {
  label: string; value: number; max: number; step?: number; onChange: (v: number) => void; sub: string
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{value}만원/년</span>
      </div>
      <input type="range" min={0} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-600" />
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, display, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-blue-600">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-blue-600" />
    </div>
  )
}

function StatCard({ label, value, color, sub, warn }: {
  label: string; value: string; color?: string; sub?: string; warn?: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600', amber: 'text-amber-600',
  }
  return (
    <div className={`card p-3 ${warn ? 'border-orange-200' : ''}`}>
      <div className="text-xs text-slate-500 mb-1 truncate">{label}</div>
      <div className={`text-base font-bold ${color ? colors[color] : 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
