'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ETF_DATA, ETF_DATA_UPDATED_AT, fmtKRW } from '@/lib/simulator'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'

interface SavedPortfolio {
  id: string
  name: string
  settings: any
  createdAt: string
}

interface Purchase {
  id: string
  date: string
  ticker: string
  amountKRW: number
  fxRate: number
  etfPrice?: number
}

type SubTab = 'saved' | 'records'

export default function PortfolioPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const router = useRouter()
  const [subTab, setSubTab] = useState<SubTab>('saved')
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([])
  const [loadingPF, setLoadingPF] = useState(true)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [form, setForm] = useState({ date: '', ticker: 'SCHD', amount: '', fxRate: '', etfPrice: '' })
  const [fxLoading, setFxLoading] = useState(false)
  const [fxAutoLoaded, setFxAutoLoaded] = useState(false)
  const [etfPriceLoading, setEtfPriceLoading] = useState(false)
  const [etfPriceAutoLoaded, setEtfPriceAutoLoaded] = useState(false)
  const [currentFxRate, setCurrentFxRate] = useState(1350)
  const [toast, setToast] = useState('')

  useEffect(() => {
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(data => { setPortfolios(data); setLoadingPF(false) })
      .catch(() => setLoadingPF(false))
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem('etf_actual_records')
      if (saved) setPurchases(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) setCurrentFxRate(d.rate)
    }).catch(() => {})
  }, [])

  async function fetchEtfPriceForDate(date: string, ticker: string) {
    if (!date || new Date(date) > new Date()) return
    setEtfPriceLoading(true)
    setEtfPriceAutoLoaded(false)
    try {
      const res = await fetch(`/api/etf-price?ticker=${ticker}&date=${date}`)
      const data = await res.json()
      if (data.price && !data.fallback) {
        setForm(f => ({ ...f, etfPrice: String(data.price) }))
        setEtfPriceAutoLoaded(true)
      }
    } catch {}
    setEtfPriceLoading(false)
  }

  async function handleDateChange(date: string) {
    setForm(f => ({ ...f, date }))
    setFxAutoLoaded(false)
    setEtfPriceAutoLoaded(false)
    if (!date) return
    if (new Date(date) > new Date()) return
    setFxLoading(true)
    try {
      const res = await fetch(`/api/fx-rate-history?date=${date}`)
      const data = await res.json()
      if (data.rate && !data.fallback) {
        setForm(f => ({ ...f, date, fxRate: String(data.rate) }))
        setFxAutoLoaded(true)
      }
    } catch {}
    setFxLoading(false)
    fetchEtfPriceForDate(date, form.ticker)
  }

  async function handleTickerChange(ticker: string) {
    setForm(f => ({ ...f, ticker, etfPrice: '' }))
    setEtfPriceAutoLoaded(false)
    if (form.date) fetchEtfPriceForDate(form.date, ticker)
  }

  function savePurchases(list: Purchase[]) {
    setPurchases(list)
    try { localStorage.setItem('etf_actual_records', JSON.stringify(list)) } catch {}
  }

  function showToastMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function addPurchase() {
    if (!form.date || !form.amount) return
    const etfPrice = Number(form.etfPrice) || undefined
    const next = [...purchases, {
      id: Date.now().toString(),
      date: form.date,
      ticker: form.ticker,
      amountKRW: Number(form.amount),
      fxRate: Number(form.fxRate) || currentFxRate,
      etfPrice,
    }]
    savePurchases(next)
    setForm(f => ({ ...f, date: '', amount: '', fxRate: '', etfPrice: '' }))
    setFxAutoLoaded(false)
    setEtfPriceAutoLoaded(false)
    showToastMsg('매수 기록이 추가됐어요')
  }

  function removePurchase(id: string) {
    savePurchases(purchases.filter(p => p.id !== id))
  }

  async function deletePortfolio(id: string) {
    await fetch(`/api/portfolio/${id}`, { method: 'DELETE' })
    setPortfolios(prev => prev.filter(p => p.id !== id))
  }

  // ✅ 저장된 포트폴리오를 Sim에서 열기
  function loadInSim(pf: SavedPortfolio) {
    try {
      const s = pf.settings
      // localStorage에 Sim 상태 저장 → dashboard에서 usePersistedState로 읽음
      if (s.allocations) localStorage.setItem('sim_allocations', JSON.stringify(s.allocations))
      if (s.years)       localStorage.setItem('sim_years', JSON.stringify(s.years))
      if (s.drip !== undefined) localStorage.setItem('sim_drip', JSON.stringify(s.drip))
      if (s.tax)         localStorage.setItem('sim_tax', JSON.stringify(s.tax))
      if (s.scenario)    localStorage.setItem('sim_scenario', JSON.stringify(s.scenario))
      if (s.fxRate)      localStorage.setItem('sim_fxRate', JSON.stringify(s.fxRate))
      router.push('/dashboard')
    } catch {
      showToastMsg('불러오기 실패')
    }
  }

  function calcReturn(p: Purchase) {
    const etf = ETF_DATA[p.ticker]
    const purchasePrice = p.etfPrice ?? etf.price
    const usdInvested = (p.amountKRW * 10000) / p.fxRate
    const shares = usdInvested / purchasePrice
    const currentValueKRW = shares * etf.price * currentFxRate
    const gainKRW = currentValueKRW - p.amountKRW * 10000
    const gainPct = (gainKRW / (p.amountKRW * 10000)) * 100
    return { currentValueKRW, gainKRW, gainPct }
  }

  // ── 수익 추이 차트 데이터 생성 ──
  function buildGrowthChartData() {
    const sorted = [...purchases].sort((a, b) => a.date.localeCompare(b.date))
    const tickers = [...new Set(sorted.map(p => p.ticker))]

    // 매수일 ~ 오늘 월별 라벨
    const start = new Date(sorted[0].date)
    const today = new Date()
    const months: string[] = []
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= today) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
      cur.setMonth(cur.getMonth() + 1)
    }
    const todayYM = today.toISOString().slice(0, 7)
    if (!months.includes(todayYM)) months.push(todayYM)

    const todayTs = today.getTime()

    // 매수 시점 월 (dot 표시용)
    const purchaseMonthsByTicker: Record<string, Set<string>> = {}
    sorted.forEach(p => {
      if (!purchaseMonthsByTicker[p.ticker]) purchaseMonthsByTicker[p.ticker] = new Set()
      purchaseMonthsByTicker[p.ticker].add(p.date.slice(0, 7))
    })

    const data = months.map(month => {
      const monthTs = new Date(month + '-15').getTime() // 월 중간값 기준
      const row: Record<string, any> = { month }

      tickers.forEach(ticker => {
        const etf = ETF_DATA[ticker]
        const currentPrice = etf.price
        const relevant = sorted.filter(p => p.ticker === ticker && p.date.slice(0, 7) <= month)
        if (relevant.length === 0) { row[ticker] = null; return }

        let totalValue = 0
        relevant.forEach(p => {
          const purchasePrice = p.etfPrice ?? currentPrice
          const purchaseTs = new Date(p.date).getTime()
          const shares = (p.amountKRW * 10000) / p.fxRate / purchasePrice
          // 매수일~오늘 사이를 선형 보간 (역사적 API 없이 추이 근사)
          const progress = todayTs > purchaseTs
            ? Math.min(1, (monthTs - purchaseTs) / (todayTs - purchaseTs))
            : 1
          const interpPrice = purchasePrice + progress * (currentPrice - purchasePrice)
          totalValue += shares * Math.max(interpPrice, 0) * currentFxRate
        })

        row[ticker] = Math.round(totalValue)
        row[`${ticker}_dot`] = purchaseMonthsByTicker[ticker]?.has(month) ?? false
      })

      return row
    })

    return { data, tickers, purchaseMonthsByTicker }
  }

  const totalInvested = purchases.reduce((s, p) => s + p.amountKRW * 10000, 0)
  const totalCurrent = purchases.reduce((s, p) => s + calcReturn(p).currentValueKRW, 0)
  const totalGainPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0

  const tickerSummary = purchases.reduce<Record<string, { invested: number; current: number }>>((acc, p) => {
    const { currentValueKRW } = calcReturn(p)
    if (!acc[p.ticker]) acc[p.ticker] = { invested: 0, current: 0 }
    acc[p.ticker].invested += p.amountKRW * 10000
    acc[p.ticker].current += currentValueKRW
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap bg-slate-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          ✅ {toast}
        </div>
      )}
      <main className="max-w-4xl mx-auto px-4 py-4">
        {/* 서브 탭 */}
        <div className="grid grid-cols-2 gap-1 bg-white rounded-xl border border-slate-200 p-1 mb-5">
          <button
            onClick={() => setSubTab('saved')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              subTab === 'saved' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span>💾</span>
            <span>저장 목록</span>
          </button>
          <button
            onClick={() => setSubTab('records')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              subTab === 'records' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span>📒</span>
            <span>매수 기록</span>
            {purchases.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 leading-none">
                {purchases.length}
              </span>
            )}
          </button>
        </div>

        {/* ─── 저장된 포트폴리오 ─── */}
        {subTab === 'saved' && (
          <div>
            {loadingPF ? (
              <div className="text-center py-12 text-slate-400 text-sm">불러오는 중...</div>
            ) : portfolios.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-3xl mb-3">💾</div>
                <div className="text-slate-500 text-sm mb-1">저장된 포트폴리오가 없어요</div>
                <div className="text-slate-400 text-xs">Sim 탭에서 시뮬레이션 후 저장해보세요</div>
              </div>
            ) : (
              <div className="space-y-3">
                {portfolios.map(pf => (
                  <div key={pf.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-slate-800 mb-1">{pf.name}</div>
                        <div className="text-xs text-slate-400 mb-2">
                          {new Date(pf.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          })} 저장
                        </div>
                        {pf.settings?.allocations && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {pf.settings.allocations.map((a: any) => (
                              <span key={a.ticker} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                {a.ticker} {a.monthly}만
                              </span>
                            ))}
                            {pf.settings.years && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                {pf.settings.years}년
                              </span>
                            )}
                            {pf.settings.scenario?.mode && (
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                {{ optimistic: '🟢 낙관', neutral: '🟡 중립', pessimistic: '🔴 비관', custom: '⚙️ 직접' }[pf.settings.scenario.mode as string] ?? pf.settings.scenario.mode}
                              </span>
                            )}
                          </div>
                        )}
                        {/* ✅ Sim에서 열기 버튼 */}
                        <button
                          onClick={() => loadInSim(pf)}
                          className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5z"/>
                          </svg>
                          Sim에서 열기
                        </button>
                      </div>
                      <button
                        onClick={() => deletePortfolio(pf.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0 mt-0.5"
                      >✕</button>
                    </div>
                  </div>
                ))}

                {/* ✅ 데이터 기준 안내 */}
                <div className="text-xs text-slate-400 text-center pt-2">
                  📊 ETF 데이터 기준: {ETF_DATA_UPDATED_AT} · 시뮬레이션은 과거 데이터 기반 추정값입니다
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── 실제 매수 기록 ─── */}
        {subTab === 'records' && (
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">매수 내역 추가</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                  <input type="date" value={form.date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => handleDateChange(e.target.value)}
                    className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">ETF</label>
                  <select className="input text-sm" value={form.ticker}
                    onChange={e => handleTickerChange(e.target.value)}>
                    {Object.keys(ETF_DATA).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">투자금액 (만원)</label>
                  <input type="number" placeholder="500" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="input text-sm" inputMode="numeric" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    당시 환율
                    {fxLoading && <span className="text-blue-400 text-xs animate-pulse">● 조회중</span>}
                    {!fxLoading && fxAutoLoaded && <span className="text-green-500 text-xs">● 자동</span>}
                  </label>
                  <input type="number" placeholder="날짜 선택 시 자동입력" value={form.fxRate}
                    onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))}
                    className="input text-sm" inputMode="numeric" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    당시 ETF 가격 ($)
                    {etfPriceLoading && <span className="text-blue-400 text-xs animate-pulse">● 조회중</span>}
                    {!etfPriceLoading && etfPriceAutoLoaded && <span className="text-green-500 text-xs">● 자동</span>}
                  </label>
                  <input type="number" placeholder="날짜 선택 시 자동입력" value={form.etfPrice}
                    onChange={e => setForm(f => ({ ...f, etfPrice: e.target.value }))}
                    className="input text-sm" inputMode="decimal" step="0.01" />
                </div>
              </div>
              <button onClick={addPurchase} disabled={!form.date || !form.amount}
                className="btn-primary w-full text-sm disabled:opacity-40">
                + 추가
              </button>
            </div>

            {purchases.length > 0 && (
              <>
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-medium text-slate-700">매수 내역</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {purchases.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => {
                      const { currentValueKRW, gainPct } = calcReturn(p)
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <div className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: ETF_DATA[p.ticker]?.color ?? '#94a3b8' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <span className="font-semibold">{p.ticker}</span>
                              <span className="text-slate-400 text-xs">{p.date}</span>
                              <span className="text-slate-600">{p.amountKRW.toLocaleString()}만원</span>
                              {p.etfPrice
                                ? <span className="text-slate-400 text-xs">${p.etfPrice}</span>
                                : <span className="text-slate-300 text-xs">{p.fxRate.toLocaleString()}원</span>}
                            </div>
                            <div className="flex gap-3 text-xs mt-0.5">
                              <span className="text-slate-400">현재 {fmtKRW(currentValueKRW)}</span>
                              <span className={gainPct >= 0 ? 'text-blue-500 font-semibold' : 'text-red-500 font-semibold'}>
                                {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <button onClick={() => removePurchase(p.id)}
                            className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">수익률 요약</h3>
                    <span className="text-xs text-slate-400">현재 환율 {currentFxRate.toLocaleString()}원 기준</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs text-slate-400 mb-1">총 투자금</div>
                      <div className="text-sm font-bold text-slate-700">{fmtKRW(totalInvested)}</div>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <div className="text-xs text-slate-400 mb-1">현재 평가액</div>
                      <div className="text-sm font-bold text-blue-600">{fmtKRW(totalCurrent)}</div>
                    </div>
                    <div className={`rounded-xl p-3 ${totalGainPct >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="text-xs text-slate-400 mb-1">총 수익률</div>
                      <div className={`text-sm font-bold ${totalGainPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {Object.keys(tickerSummary).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-2">ETF별 수익률 breakdown</div>
                      <div className="space-y-2">
                        {Object.entries(tickerSummary).map(([t, v]) => {
                          const gainPct = ((v.current - v.invested) / v.invested) * 100
                          const weight = totalCurrent > 0 ? (v.current / totalCurrent) * 100 : 0
                          const etf = ETF_DATA[t]
                          return (
                            <div key={t} className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: etf?.color ?? '#94a3b8' }} />
                              <span className="text-sm font-medium w-12">{t}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${weight}%`, background: etf?.color ?? '#94a3b8' }} />
                              </div>
                              <span className="text-xs text-slate-500 w-10 text-right">{weight.toFixed(0)}%</span>
                              <span className={`text-xs font-semibold w-14 text-right ${gainPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 수익 추이 라인 차트 ── */}
                {purchases.length < 2 ? (
                  <div className="card p-6 text-center text-xs text-slate-400">
                    매수 기록을 2개 이상 추가하면 수익 추이 차트가 표시됩니다
                  </div>
                ) : (() => {
                  const { data, tickers } = buildGrowthChartData()
                  const fmtAxis = (v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(0)}억` : `${(v / 1e4).toFixed(0)}만`
                  // X축 라벨: 많으면 간격 조정
                  const interval = data.length > 24 ? 5 : data.length > 12 ? 2 : 0
                  return (
                    <div className="card p-4">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">수익 추이</h3>
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={interval} />
                          <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: '#94a3b8' }} width={48} />
                          <Tooltip
                            formatter={(v: number, name: string) => [fmtKRW(v), name]}
                            labelStyle={{ fontSize: 11, color: '#64748b' }}
                            contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          {tickers.map(t => {
                            const color = ETF_DATA[t]?.color ?? '#94a3b8'
                            return (
                              <Line key={t} type="monotone" dataKey={t}
                                stroke={color} strokeWidth={2.5}
                                connectNulls
                                isAnimationActive={false}
                                dot={(dotProps: any) => {
                                  const { cx, cy, payload, index } = dotProps
                                  if (!payload[`${t}_dot`]) return <circle key={index} r={0} cx={cx} cy={cy} fill="none" />
                                  return <circle key={index} cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
                                }}
                                activeDot={{ r: 4 }}
                              />
                            )
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-slate-400 text-center mt-2">
                        * 매수가↔현재가 선형 보간 추이 · 실제 주가 흐름과 다를 수 있음
                      </p>
                    </div>
                  )
                })()}

                <p className="text-xs text-slate-400 text-center">
                  * 현재 기준가 + 실시간 환율 기반 추정치 · 이 기기 브라우저에 저장됩니다
                </p>
              </>
            )}

            {purchases.length === 0 && (
              <div className="card p-10 text-center">
                <div className="text-3xl mb-3">📒</div>
                <div className="text-slate-500 text-sm mb-1">매수 내역을 추가해보세요</div>
                <div className="text-slate-400 text-xs">날짜 선택 시 당시 환율을 자동으로 불러와요</div>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
