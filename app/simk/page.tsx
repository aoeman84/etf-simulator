'use client'
import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ScenarioModal, { ScenarioSettings } from '@/components/ScenarioModal'
import { fmtKRW, ETF_DATA } from '@/lib/simulator'
import { usePersistedState } from '@/lib/usePersistedState'
import { simulateK, SimKYearRow, EtfAlloc, MonthlyAccount, AnnualAccount, SCENARIO_YIELD, getScenarioMode } from '@/lib/simulatorK'

const DEFAULT_SCENARIO: ScenarioSettings = {
  mode: 'optimistic',
  priceCAGRAdj: 0,
  divGrowthAdj: 0,
  inflationRate: 2.5,
}

const SIMK_TICKERS = ['SCHD', 'VOO', 'QQQ']

const SCENARIO_MODES = ['optimistic', 'neutral', 'pessimistic'] as const
const SCENARIO_LABELS: Record<string, string> = { optimistic: '낙관', neutral: '중립', pessimistic: '비관' }

const tickerColors: Record<string, string> = {
  SCHD: '#2563eb',
  VOO:  '#0891b2',
  QQQ:  '#7c3aed',
}

const TICKER_ACCENT: Record<string, string> = {
  SCHD: 'accent-blue-600',
  VOO:  'accent-green-600',
  QQQ:  'accent-purple-600',
}

interface AccountState {
  monthly: number
  annual: number
  etfAlloc: EtfAlloc[]
}

const DEFAULT_ALLOC: EtfAlloc[] = SIMK_TICKERS.map((t, i) => ({ ticker: t, pct: i === 0 ? 100 : 0 }))

function allocSum(allocs: EtfAlloc[]) {
  return allocs.reduce((s, a) => s + a.pct, 0)
}

function fmt(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  return `${Math.round(n / 1e4)}만`
}

function buildAcct(state: AccountState, mode: 'monthly' | 'annual'): MonthlyAccount | AnnualAccount {
  return mode === 'monthly'
    ? { monthlyWan: state.monthly, etfAlloc: state.etfAlloc }
    : { annualWan: state.annual, etfAlloc: state.etfAlloc }
}

function singleEtfAlloc(ticker: string): EtfAlloc[] {
  return SIMK_TICKERS.map(t => ({ ticker: t, pct: t === ticker ? 100 : 0 }))
}

export default function SimKPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [mode, setMode] = usePersistedState<'monthly' | 'annual'>('simk_mode', 'monthly')
  const [isaState, setIsaState] = usePersistedState<AccountState>('simk_isa_v2', {
    monthly: 166, annual: 2000, etfAlloc: DEFAULT_ALLOC,
  })
  const [pensionState, setPensionState] = usePersistedState<AccountState>('simk_pension_v2', {
    monthly: 50, annual: 240, etfAlloc: DEFAULT_ALLOC,
  })
  const [irpState, setIrpState] = usePersistedState<AccountState>('simk_irp_v2', {
    monthly: 25, annual: 144, etfAlloc: DEFAULT_ALLOC,
  })
  const [taxCreditRate, setTaxCreditRate] = usePersistedState<number>('simk_taxRate', 0.132)
  const [startAge, setStartAge] = usePersistedState<number>('simk_startAge', 35)
  const [currentAge, setCurrentAge] = usePersistedState<number>('simk_currentAge', 35)
  const [retirementAge, setRetirementAge] = usePersistedState<number>('simk_retirementAge', 65)
  const [reinvestRefund, setReinvestRefund] = usePersistedState<boolean>('simk_reinvest', false)
  const [scenario, setScenario] = usePersistedState<ScenarioSettings>('scenario', DEFAULT_SCENARIO)
  const [taxWarningOpen, setTaxWarningOpen] = useState(false)
  const [fxRate, setFxRate] = useState(1350)
  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => { if (d.rate) setFxRate(d.rate) }).catch(() => {})
  }, [])

  const isaValid     = allocSum(isaState.etfAlloc) === 100
  const pensionValid = allocSum(pensionState.etfAlloc) === 100
  const irpValid     = allocSum(irpState.etfAlloc) === 100
  const allocValid   = isaValid && pensionValid && irpValid

  const baseParams = useMemo(() => ({
    mode, taxCreditRate, startAge, retirementAge, reinvestRefund, scenario,
  }), [mode, taxCreditRate, startAge, retirementAge, reinvestRefund, scenario])

  const primary = useMemo(() => {
    if (!allocValid) return null
    return simulateK({
      ...baseParams,
      isa:     buildAcct(isaState, mode),
      pension: buildAcct(pensionState, mode),
      irp:     buildAcct(irpState, mode),
    })
  }, [baseParams, isaState, pensionState, irpState, mode, allocValid])

  const comparisonResults = useMemo(() => {
    return SIMK_TICKERS.map(ticker => ({
      ticker,
      result: simulateK({
        ...baseParams,
        isa:     { ...buildAcct(isaState, mode), etfAlloc: singleEtfAlloc(ticker) } as MonthlyAccount | AnnualAccount,
        pension: { ...buildAcct(pensionState, mode), etfAlloc: singleEtfAlloc(ticker) } as MonthlyAccount | AnnualAccount,
        irp:     { ...buildAcct(irpState, mode), etfAlloc: singleEtfAlloc(ticker) } as MonthlyAccount | AnnualAccount,
      }),
    }))
  }, [baseParams, isaState, pensionState, irpState, mode])

  const scenarioGrid = useMemo(() => {
    return SIMK_TICKERS.map(ticker => ({
      ticker,
      cells: SCENARIO_MODES.map(sm => ({
        mode: sm,
        result: simulateK({
          ...baseParams,
          scenario: { priceCAGRAdj: 0, divGrowthAdj: 0, mode: sm },
          isa:     { ...buildAcct(isaState, mode), etfAlloc: singleEtfAlloc(ticker) } as MonthlyAccount | AnnualAccount,
          pension: { ...buildAcct(pensionState, mode), etfAlloc: singleEtfAlloc(ticker) } as MonthlyAccount | AnnualAccount,
          irp:     { ...buildAcct(irpState, mode), etfAlloc: singleEtfAlloc(ticker) } as MonthlyAccount | AnnualAccount,
        }),
      })),
    }))
  }, [baseParams, isaState, pensionState, irpState, mode])

  const chartData = useMemo(() => {
    if (!primary) return []
    return primary.rows.map(row => {
      const normal    = Math.round(row.normalBalance / 1e4)
      const withCredit = Math.round((row.totalBalance + row.cumulativeTaxCredit) / 1e4)
      const withReinvest = Math.round((row.totalBalance + row.taxCreditReinvestedBalance) / 1e4)
      return {
        label: `${row.age}세 (${row.year}년)`,
        '일반계좌 (세후)':           normal,
        '절세계좌 + 세액공제':        withCredit,
        '절세계좌 + 세액공제 재투자': withReinvest,
        '초과분 (미재투자)': withCredit - normal,
        '초과분 (재투자)':   withReinvest - normal,
      }
    })
  }, [primary])

  const activeTickers = useMemo(() => {
    const all = [...isaState.etfAlloc, ...pensionState.etfAlloc, ...irpState.etfAlloc]
    return [...new Set(all.filter(a => a.pct > 0).map(a => a.ticker))]
  }, [isaState, pensionState, irpState])

  const years = Math.max(1, retirementAge - startAge)
  const zoomStartYear = Math.max(0, years - 10)
  const zoomedData = chartData.slice(zoomStartYear)
  const monthlyPensionGross = primary ? primary.finalBalance / 20 / 12 : 0
  const pensionWarning = monthlyPensionGross > 1_000_000
  const fxSensitivity = primary ? Math.round(primary.finalBalance * (100 / fxRate)) : 0

  const totalMonthly = isaState.monthly + pensionState.monthly + irpState.monthly
  const totalAnnual  = isaState.annual + pensionState.annual + irpState.annual

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar titleSlot={<ScenarioModal scenario={scenario} onChange={setScenario} selectedTickers={activeTickers} useSimkYield />} />
      <div className="bg-white border-b border-slate-100 py-2 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">💡 절세 계좌 시뮬레이터 · ISA + 연금저축 + IRP를 활용했을 때 절세 효과를 계산합니다</div>
      </div>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
<div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">

          {/* ── 왼쪽 패널 ── */}
          <div className="space-y-4">

            {/* 납입 방식 */}
            <div className="card p-3 sm:p-4">
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
              <div className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2 flex justify-between">
                <span className="text-slate-400">총 {mode === 'monthly' ? '월' : '연간'} 납입액</span>
                <span className="font-semibold text-slate-700">
                  {mode === 'monthly' ? `${totalMonthly}만원/월` : `${totalAnnual}만원/년`}
                </span>
              </div>
            </div>

            {/* 계좌별 카드 */}
            <AccountCard
              label="ISA" color="blue"
              state={isaState} setState={setIsaState}
              mode={mode}
              monthlyMax={166} monthlyStep={1}
              annualMax={2000} annualStep={100}
              sub="연 2,000만원 한도 · 166만원/월이 최대 효율"
            />
            <AccountCard
              label="연금저축" color="green"
              state={pensionState} setState={setPensionState}
              mode={mode}
              monthlyMax={125} monthlyStep={1}
              annualMax={1500} annualStep={100}
              sub="세액공제 한도 600만원 · 초과 납입은 세혜택 없음"
            />
            <AccountCard
              label="IRP" color="purple"
              state={irpState} setState={setIrpState}
              mode={mode}
              monthlyMax={25} monthlyStep={1}
              annualMax={300} annualStep={50}
              sub="연금저축+합산 900만원까지 세액공제"
            />

            {/* 세액공제율 */}
            <div className="card p-3 sm:p-4">
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
            <div className="card p-3 sm:p-4 space-y-3">
              <SliderRow label="투자 시작 나이" value={startAge} min={20} max={60} step={1}
                display={`${startAge}세`} onChange={v => { setStartAge(v); if (currentAge < v) setCurrentAge(v) }} />
              <SliderRow label="현재 나이" value={currentAge} min={startAge} max={60} step={1}
                display={`${currentAge}세`} onChange={setCurrentAge} />
              <SliderRow label="연금 수령 나이" value={retirementAge} min={55} max={80} step={1}
                display={`${retirementAge}세`} onChange={setRetirementAge} />
              <div className="text-xs text-slate-400 text-center">
                총 납입 기간: <span className="font-semibold text-slate-600">{years}년</span>
                {currentAge > startAge && (
                  <span className="ml-2 text-slate-400">
                    (이미 <span className="font-semibold text-green-600">{currentAge - startAge}년</span> 납입 중)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input type="checkbox" id="reinvest" checked={reinvestRefund}
                  onChange={e => setReinvestRefund(e.target.checked)}
                  className="w-4 h-4 accent-blue-600" />
                <label htmlFor="reinvest" className="text-sm cursor-pointer select-none">
                  세액공제 환급금 연금저축에 재투자
                </label>
              </div>
            </div>
          </div>

          {/* ── 오른쪽 ── */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-5">

            {/* 핵심 지표 카드 */}
            {primary && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                  <StatCard label="총 납입원금" value={fmtKRW(primary.totalContributed)} />
                  <StatCard label="절세 계좌 최종 잔액" value={fmtKRW(primary.finalBalance)}
                    color="blue" sub={`${retirementAge}세 기준`} />
                  <StatCard label="일반 계좌 대비 절세 효과"
                    value={primary.taxAdvantage >= 0
                      ? `+${fmtKRW(primary.taxAdvantage)}`
                      : fmtKRW(primary.taxAdvantage)}
                    color={primary.taxAdvantage >= 0 ? 'green' : undefined}
                    sub="연금세 · 양도세 차감 세후 비교" />
                  <StatCard label="예상 월 연금 수령액"
                    value={fmtKRW(primary.monthlyPension)}
                    color="amber"
                    sub={pensionWarning
                      ? '⚠️ 연 1,200만 초과 → 종합과세 주의'
                      : `연금소득세 ${(primary.pensionTaxRate * 100).toFixed(1)}% 후`}
                    warn={pensionWarning} />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs text-slate-500">
                  💱 환율 민감도: 환율 +100원 → 최종잔액 +{fmtKRW(fxSensitivity)} <span className="text-slate-400">(현재 {fxRate.toLocaleString()}원 기준)</span>
                </div>
              </>
            )}

            {!allocValid && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-orange-700">
                ⚠️ 계좌별 ETF 비율 합계를 100%로 맞춰야 시뮬레이션 결과가 표시됩니다.
              </div>
            )}

            {pensionWarning && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 text-xs text-orange-700 leading-relaxed">
                ⚠️ {retirementAge}세 수령 시 월 {fmtKRW(monthlyPensionGross)}으로 연 1,200만원을 초과합니다.
                종합과세 대상이 될 수 있으니 수령 기간을 {retirementAge + 5}세 이후로 연장하거나 분산 수령을 검토하세요.
              </div>
            )}

            {/* 2025 외국납부세액 경고 */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setTaxWarningOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <span>⚠️ 2025년 외국납부세액 공제 변경 안내</span>
                <span className="text-amber-500 text-xs">{taxWarningOpen ? '▲' : '▼'}</span>
              </button>
              {taxWarningOpen && (
                <div className="px-4 pb-3 text-xs text-amber-700 leading-relaxed border-t border-amber-200 pt-2.5 space-y-1">
                  <p>2025년부터 해외주식형 ETF(SCHD 등) 분배금에 미국 원천세(15%)가 연금계좌 입금 전 차감됩니다.</p>
                  <p>배당 비중이 높은 ETF의 복리 효과가 일부 감소할 수 있으며, 정부의 이중과세 보완책은 논의 중입니다.</p>
                </div>
              )}
            </div>

            {/* 포트폴리오 vs 단일 ETF 비교 표 */}
            <div className="card overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="text-sm font-semibold text-slate-700">포트폴리오 절세 효과 비교</div>
                <div className="text-xs text-slate-400 mt-0.5">동일 납입 조건 · {retirementAge}세 기준</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '340px' }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-3 py-2.5 font-medium text-slate-500">구성</th>
                      <th className="text-right px-2 sm:px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">
                        <span className="hidden sm:inline">세액공제 누적</span>
                        <span className="sm:hidden">세액공제</span>
                      </th>
                      <th className="text-right px-2 sm:px-3 py-2.5 font-medium text-slate-500 whitespace-nowrap">
                        <span className="hidden sm:inline">절세 계좌 잔액</span>
                        <span className="sm:hidden">잔액</span>
                      </th>
                      <th className="text-right px-2 sm:px-4 py-2.5 font-medium text-slate-500 whitespace-nowrap">
                        <span className="hidden sm:inline">일반 대비 이득</span>
                        <span className="sm:hidden">절세이득</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="bg-blue-50">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-blue-700">내 포트폴리오</div>
                        <div className="text-slate-400 mt-0.5 leading-tight">
                          {[
                            { key: 'isa' as const, label: 'ISA', state: isaState },
                            { key: 'pension' as const, label: '연금', state: pensionState },
                            { key: 'irp' as const, label: 'IRP', state: irpState },
                          ].map(({ label, state }) => {
                            const active = state.etfAlloc.filter(a => a.pct > 0)
                            if (active.length === 0) return null
                            return (
                              <span key={label} className="mr-2">
                                {label}: {active.map(a => `${a.ticker} ${a.pct}%`).join('+')}
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right font-medium text-sky-500 whitespace-nowrap">
                        {primary ? fmtKRW(primary.totalTaxCredit) : '-'}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {primary ? fmtKRW(primary.finalBalance) : '-'}
                      </td>
                      <td className={`px-2 sm:px-4 py-2.5 text-right font-semibold whitespace-nowrap ${
                        primary && primary.taxAdvantage >= 0 ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {primary
                          ? `${primary.taxAdvantage >= 0 ? '+' : ''}${fmtKRW(primary.taxAdvantage)}`
                          : '-'}
                      </td>
                    </tr>
                    {comparisonResults.map(({ ticker, result }) => {
                      const simkMode = getScenarioMode({ priceCAGRAdj: scenario.priceCAGRAdj, divGrowthAdj: scenario.divGrowthAdj, mode: scenario.mode })
                      const simkYieldPct = ((SCENARIO_YIELD[simkMode]?.[ticker] ?? ETF_DATA[ticker].divYield / 100) * 100).toFixed(1)
                      return (
                      <tr key={ticker} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: tickerColors[ticker] }} />
                            <span className="font-semibold text-slate-700">{ticker}</span>
                            <span className="text-slate-400 hidden sm:inline">배당 {simkYieldPct}% / CAGR {ETF_DATA[ticker].priceCAGR}%</span>
                            <span className="text-slate-400 sm:hidden">{ETF_DATA[ticker].priceCAGR}%</span>
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-2.5 text-right font-medium text-sky-500 whitespace-nowrap">
                          {fmtKRW(result.totalTaxCredit)}
                        </td>
                        <td className="px-2 sm:px-3 py-2.5 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {fmtKRW(result.finalBalance)}
                        </td>
                        <td className={`px-2 sm:px-4 py-2.5 text-right font-semibold whitespace-nowrap ${
                          result.taxAdvantage >= 0 ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {result.taxAdvantage >= 0 ? '+' : ''}{fmtKRW(result.taxAdvantage)}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3×3 시나리오 × ETF 비교 그리드 */}
            <div className="card overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <div className="text-sm font-semibold text-slate-700">시나리오별 최종잔액 비교 (3×3)</div>
                <div className="text-xs text-slate-400 mt-0.5">ETF × 시나리오 · 동일 납입 조건 · {retirementAge}세 기준</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: '320px' }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-3 py-2.5 font-medium text-slate-500">ETF</th>
                      {SCENARIO_MODES.map(sm => {
                        const isCurrent = getScenarioMode(scenario) === sm
                        return (
                          <th key={sm} className={`text-right px-3 py-2.5 font-medium whitespace-nowrap ${
                            isCurrent ? 'text-blue-600 bg-blue-50' : 'text-slate-500'
                          }`}>
                            {SCENARIO_LABELS[sm]}
                            {isCurrent && <span className="ml-1 text-blue-400">◀</span>}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {scenarioGrid.map(({ ticker, cells }) => (
                      <tr key={ticker} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tickerColors[ticker] }} />
                            <span className="font-semibold text-slate-700">{ticker}</span>
                          </div>
                        </td>
                        {cells.map(({ mode: sm, result }) => {
                          const isCurrent = getScenarioMode(scenario) === sm
                          return (
                            <td key={sm} className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${
                              isCurrent ? 'text-blue-700 bg-blue-50' : 'text-slate-700'
                            }`}>
                              {fmtKRW(result.finalBalance)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 비교 차트 — lg에서 좌우 나란히 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* 메인 3선 차트 */}
              <div className="card p-3 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">절세 계좌 vs 일반 계좌 비교</h2>
                    <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">일반 계좌: 배당 15.4% 원천징수 · 매도 시 양도세 22% 적용</p>
                  </div>
                  <ScenarioModal scenario={scenario} onChange={setScenario} selectedTickers={activeTickers} useSimkYield />
                </div>
                <ResponsiveContainer width="100%" height={256}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }}
                      interval={Math.max(1, Math.floor(years / 5))} />
                    <YAxis tickFormatter={v => fmt(v * 1e4)} tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickCount={5} domain={[(dataMin: number) => dataMin * 0.9, (dataMax: number) => dataMax * 1.02]} />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmt(v * 1e4) + '원', name]}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="일반계좌 (세후)"           stroke="#ef4444" strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                    <Line type="monotone" dataKey="절세계좌 + 세액공제"        stroke="#93c5fd" strokeWidth={2}   dot={false} />
                    <Line type="monotone" dataKey="절세계좌 + 세액공제 재투자" stroke="#1d4ed8" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                <p className="text-xs text-slate-400 mt-2 text-center">
                  세액공제를 재투자하면 절세 효과가 더 커집니다
                </p>
              </div>

              {/* 절세 효과 차이 차트 */}
              <div className="card p-3 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-700">절세 효과 확대 뷰 (수령 5년 전~)</h2>
                    <p className="text-xs text-slate-400 mt-0.5">수령 시점 전후 구간만 확대</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={256}>
                  <ComposedChart data={zoomedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }}
                      interval={Math.max(0, Math.floor(zoomedData.length / 5))} />
                    <YAxis tickFormatter={v => fmt(v * 1e4)} tick={{ fontSize: 11, fill: '#94a3b8' }}
                      tickCount={5}
                      domain={[(dataMin: number) => dataMin * 0.97, (dataMax: number) => dataMax * 1.01]} />
                    <Tooltip
                      formatter={(v: number, name: string) => [fmt(v * 1e4) + '원', name]}
                      contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="일반계좌 (세후)"           stroke="#ef4444" strokeWidth={2}   dot={false} strokeDasharray="5 3" />
                    <Line type="monotone" dataKey="절세계좌 + 세액공제"        stroke="#93c5fd" strokeWidth={2}   dot={false} />
                    <Line type="monotone" dataKey="절세계좌 + 세액공제 재투자" stroke="#1d4ed8" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

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
                      {primary.rows.map((row: SimKYearRow) => {
                        const isPast    = row.age < currentAge
                        const isCurrent = row.age === currentAge
                        const rowBg = isCurrent
                          ? 'bg-green-50'
                          : isPast
                            ? 'bg-slate-50 opacity-60'
                            : row.isaTransfer > 0 ? 'bg-blue-50' : ''
                        return (
                          <tr key={row.year} className={`hover:opacity-100 ${rowBg}`}>
                            <td className={`px-3 py-2.5 font-medium whitespace-nowrap sticky left-0 z-10 ${isCurrent ? 'bg-green-50' : isPast ? 'bg-slate-50' : 'bg-white'}`}
                              style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }}>
                              {row.year}년차
                              <span className="text-slate-400 ml-1">({row.age}세)</span>
                              {isCurrent && <span className="ml-1 text-green-600 font-bold text-xs">● 현재</span>}
                              {row.isaTransfer > 0 && <span className="ml-1 text-blue-500 font-bold">↗ ISA 만기</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-sky-500 whitespace-nowrap">{fmtKRW(row.isaBalance)}</td>
                            <td className="px-3 py-2.5 text-right text-emerald-500 whitespace-nowrap">{fmtKRW(row.pensionBalance)}</td>
                            <td className="px-3 py-2.5 text-right text-violet-500 whitespace-nowrap">{fmtKRW(row.irpBalance)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-600 font-medium whitespace-nowrap">+{fmtKRW(row.taxCreditThisYear)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">{fmtKRW(row.cumulativeTaxCredit)}</td>
                          </tr>
                        )
                      })}
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

// ── AccountCard ─────────────────────────────────────────────────────────────

interface AccountCardProps {
  label: string
  color: 'blue' | 'green' | 'purple'
  state: AccountState
  setState: (s: AccountState | ((prev: AccountState) => AccountState)) => void
  mode: 'monthly' | 'annual'
  monthlyMax: number
  monthlyStep: number
  annualMax: number
  annualStep: number
  sub: string
}

function AccountCard({
  label, color, state, setState, mode,
  monthlyMax, monthlyStep, annualMax, annualStep, sub,
}: AccountCardProps) {
  const [expanded, setExpanded] = useState(true)

  const colorMap      = { blue: 'text-sky-500',     green: 'text-emerald-500',  purple: 'text-violet-500'   }
  const TICKER_ACCENT: Record<string, string> = { SCHD: '', VOO: '', QQQ: '' }

  const sum = allocSum(state.etfAlloc)
  const valid = sum === 100

  function setAmount(v: number) {
    setState(prev => ({
      ...prev,
      [mode === 'monthly' ? 'monthly' : 'annual']: v,
    }))
  }

  function setAllocPct(ticker: string, pct: number) {
    if (ticker === 'QQQ') return // QQQ는 자동 계산, 직접 변경 불가
    setState(prev => {
      const schdPct = ticker === 'SCHD' ? pct : (prev.etfAlloc.find(a => a.ticker === 'SCHD')?.pct ?? 0)
      const vooPct  = ticker === 'VOO'  ? pct : (prev.etfAlloc.find(a => a.ticker === 'VOO')?.pct  ?? 0)
      const clampedSchd = Math.max(0, Math.min(100, schdPct))
      const clampedVoo  = Math.max(0, Math.min(100 - clampedSchd, vooPct))
      const qqqPct = Math.max(0, 100 - clampedSchd - clampedVoo)
      return {
        ...prev,
        etfAlloc: prev.etfAlloc.map(a => {
          if (a.ticker === 'SCHD') return { ...a, pct: clampedSchd }
          if (a.ticker === 'VOO')  return { ...a, pct: clampedVoo }
          if (a.ticker === 'QQQ')  return { ...a, pct: qqqPct }
          return a
        }),
      }
    })
  }

  const amount = mode === 'monthly' ? state.monthly : state.annual
  const max    = mode === 'monthly' ? monthlyMax : annualMax
  const step   = mode === 'monthly' ? monthlyStep : annualStep
  const unit   = mode === 'monthly' ? '만원/월' : '만원/년'

  return (
    <div className="card p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${colorMap[color]}`}>{label}</span>
        <span className="text-xs text-slate-400">max {mode === 'monthly' ? `${monthlyMax}만원/월` : `${annualMax}만원/년`}</span>
      </div>

      {/* 납입액 슬라이더 + 직접입력 */}
      <AmountInput
        value={amount} min={0} max={max} step={step} unit={unit}
        sliderClass=""
        onChange={setAmount}
      />
      <div className="text-xs text-slate-400">{sub}</div>

      {/* ETF 배분 토글 */}
      <div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <span>ETF 배분</span>
          <span className="text-slate-400">{expanded ? '▲' : '▼'}</span>
          <span className={`ml-2 font-semibold ${valid ? 'text-green-600' : 'text-red-500'}`}>
            {sum}% {valid ? '✓' : '⚠'}
          </span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5">
            {state.etfAlloc.map(({ ticker, pct }) => {
              const isAuto = ticker === 'QQQ'
              return (
                <div key={ticker} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tickerColors[ticker] }} />
                  <span className={`text-xs font-medium w-10 flex-shrink-0 ${isAuto ? 'text-slate-400' : 'text-slate-600'}`}>{ticker}</span>
                  <input
                    type="range" min={0} max={100} step={5} value={pct}
                    disabled={isAuto}
                    onChange={e => setAllocPct(ticker, Number(e.target.value))}
                    className={`flex-1 ${isAuto ? 'opacity-70 cursor-not-allowed' : ''}`}
                  />
                  <PctInput value={pct} onChange={v => setAllocPct(ticker, v)} disabled={isAuto} />
                </div>
              )
            })}
            <div className="text-xs text-slate-400 pt-0.5">QQQ = 100 − SCHD − VOO (자동)</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 작은 입력 컴포넌트들 ─────────────────────────────────────────────────────

function AmountInput({ value, min, max, step, unit, sliderClass, onChange }: {
  value: number; min: number; max: number; step: number; unit: string
  sliderClass: string; onChange: (v: number) => void
}) {
  const [inputVal, setInputVal] = useState(String(value))
  useMemo(() => setInputVal(String(value)), [value])

  return (
    <div className="flex items-center gap-2">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`flex-1 ${sliderClass}`}
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type="number" min={min} max={max} step={step} value={inputVal}
          onChange={e => {
            setInputVal(e.target.value)
            const n = parseInt(e.target.value, 10)
            if (!isNaN(n) && n >= min && n <= max) onChange(n)
          }}
          onBlur={() => {
            const n = parseInt(inputVal, 10)
            const c = isNaN(n) ? min : Math.min(max, Math.max(min, n))
            setInputVal(String(c))
            onChange(c)
          }}
          className="w-16 text-right border border-slate-200 rounded-xl px-2 py-1 text-sm font-semibold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
          inputMode="numeric"
        />
        <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  )
}

function PctInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [inputVal, setInputVal] = useState(String(value))
  useMemo(() => setInputVal(String(value)), [value])

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <input
        type="number" min={0} max={100} step={5} value={inputVal}
        disabled={disabled}
        onChange={e => {
          setInputVal(e.target.value)
          const n = parseInt(e.target.value, 10)
          if (!isNaN(n) && n >= 0 && n <= 100) onChange(n)
        }}
        onBlur={() => {
          const n = parseInt(inputVal, 10)
          const c = isNaN(n) ? 0 : Math.min(100, Math.max(0, n))
          setInputVal(String(c))
          onChange(c)
        }}
        className={`w-12 text-right border rounded-lg px-1.5 py-1 text-xs font-semibold outline-none ${
          disabled
            ? 'border-purple-200 bg-purple-50 text-purple-400 cursor-not-allowed opacity-70'
            : 'border-slate-200 text-slate-700 focus:ring-1 focus:ring-blue-400'
        }`}
        inputMode="numeric"
      />
      <span className="text-xs text-slate-400">%</span>
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
      <input type="range" min={min} max={max} step={step} value={value}
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
    <div className={`card p-2.5 sm:p-3 ${warn ? 'border-orange-200' : ''}`}>
      <div className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1 leading-tight">{label}</div>
      <div className={`text-sm sm:text-base font-bold ${color ? colors[color] : 'text-slate-800'}`}>{value}</div>
      {sub && <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5 leading-tight">{sub}</div>}
    </div>
  )
}
