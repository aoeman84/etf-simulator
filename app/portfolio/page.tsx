'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ETF_DATA, ETF_DATA_UPDATED_AT, fmtKRW } from '@/lib/simulator'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine,
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
  const { data: session, status } = useSession()
  const isLoggedIn = status === 'authenticated'

  const router = useRouter()
  const [subTab, setSubTab] = useState<SubTab>('saved')
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([])
  const [loadingPF, setLoadingPF] = useState(true)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [form, setForm] = useState({ date: '', ticker: 'SCHD', amount: '', fxRate: '', etfPrice: '' })
  const [fxLoading, setFxLoading] = useState(false)
  const [fxAutoLoaded, setFxAutoLoaded] = useState(false)
  const [etfPriceLoading, setEtfPriceLoading] = useState(false)
  const [etfPriceAutoLoaded, setEtfPriceAutoLoaded] = useState(false)
  const [currentFxRate, setCurrentFxRate] = useState(1350)
  const [toast, setToast] = useState('')
  const [chartPeriod, setChartPeriod] = useState<'1M'|'6M'|'1Y'|'5Y'|'10Y'>('1Y')
  const [priceHistoryByPeriod, setPriceHistoryByPeriod] = useState<Record<string, Record<string, { date: string; close: number }[]>>>({})
  const [chartLoading, setChartLoading] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})

  useEffect(() => {
    if (status === 'loading') return
    if (!isLoggedIn) { setLoadingPF(false); return }
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPortfolios(data); setLoadingPF(false) })
      .catch(() => setLoadingPF(false))
  }, [status, isLoggedIn])

  useEffect(() => {
    if (status === 'loading') return
    if (isLoggedIn) {
      fetch('/api/purchase')
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setPurchases(data); setLoadingRecords(false) })
        .catch(() => setLoadingRecords(false))
    } else {
      try {
        const saved = localStorage.getItem('etf_actual_records')
        if (saved) setPurchases(JSON.parse(saved))
      } catch {}
      setLoadingRecords(false)
    }
  }, [status, isLoggedIn])

  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) setCurrentFxRate(d.rate)
    }).catch(() => {})
  }, [])

  // ── 종목 변경 시 현재 실시간 가격 fetch ──
  const uniqueTickersKey = [...new Set(purchases.map(p => p.ticker))].sort().join(',')
  useEffect(() => {
    if (!uniqueTickersKey) return
    uniqueTickersKey.split(',').forEach(ticker => {
      fetch(`/api/etf-price?ticker=${ticker}`)
        .then(r => r.json())
        .then(d => { if (d.price) setLivePrices(prev => ({ ...prev, [ticker]: d.price })) })
        .catch(() => {})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueTickersKey])

  // ── 종목 또는 기간 변경 시 주가 히스토리 fetch ──
  const PERIOD_DAYS: Record<string, number> = { '1M': 30, '6M': 180, '1Y': 365, '5Y': 1825, '10Y': 3650 }
  const PERIOD_INTERVAL: Record<string, string> = { '1M': '1d', '6M': '1d', '1Y': '1d', '5Y': '1wk', '10Y': '1wk' }
  const periodFetchKey = `${uniqueTickersKey}__${chartPeriod}`
  useEffect(() => {
    if (!uniqueTickersKey) return
    const tickers = uniqueTickersKey.split(',')
    const periodHistory = priceHistoryByPeriod[chartPeriod] ?? {}
    const needFetch = tickers.filter(t => !(t in periodHistory))
    if (needFetch.length === 0) return
    const days = PERIOD_DAYS[chartPeriod]
    const intervalParam = PERIOD_INTERVAL[chartPeriod]
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 86400 * 1000).toISOString().split('T')[0]
    setChartLoading(true)
    Promise.all(
      needFetch.map(ticker =>
        fetch(`/api/etf-price?ticker=${ticker}&start=${startDate}&end=${endDate}&interval=${intervalParam}`)
          .then(r => r.json())
          .then(d => ({ ticker, history: d.history ?? [] }))
          .catch(() => ({ ticker, history: [] }))
      )
    ).then(results => {
      setPriceHistoryByPeriod(prev => {
        const pd = { ...(prev[chartPeriod] ?? {}) }
        results.forEach(r => { pd[r.ticker] = r.history })
        return { ...prev, [chartPeriod]: pd }
      })
      setChartLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFetchKey])

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

  function showToastMsg(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function addPurchase() {
    if (!form.date || !form.amount) return
    const etfPrice = Number(form.etfPrice) || undefined
    const fxRate = Number(form.fxRate) || currentFxRate
    if (isLoggedIn) {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: form.ticker,
          date: form.date,
          amountKRW: Number(form.amount),
          fxRate,
          etfPrice,
        }),
      })
      if (res.ok) {
        const record = await res.json()
        setPurchases(prev => [record, ...prev])
        setForm(f => ({ ...f, date: '', amount: '', fxRate: '', etfPrice: '' }))
        setFxAutoLoaded(false)
        setEtfPriceAutoLoaded(false)
        showToastMsg('매수 기록이 추가됐어요')
      }
    } else {
      const newRecord: Purchase = {
        id: Date.now().toString(),
        date: form.date,
        ticker: form.ticker,
        amountKRW: Number(form.amount),
        fxRate,
        etfPrice,
      }
      const next = [newRecord, ...purchases]
      setPurchases(next)
      try { localStorage.setItem('etf_actual_records', JSON.stringify(next)) } catch {}
      setForm(f => ({ ...f, date: '', amount: '', fxRate: '', etfPrice: '' }))
      setFxAutoLoaded(false)
      setEtfPriceAutoLoaded(false)
      showToastMsg('매수 기록이 추가됐어요')
    }
  }

  async function removePurchase(id: string) {
    if (isLoggedIn) {
      await fetch(`/api/purchase/${id}`, { method: 'DELETE' })
    } else {
      try { localStorage.setItem('etf_actual_records', JSON.stringify(purchases.filter(p => p.id !== id))) } catch {}
    }
    setPurchases(prev => prev.filter(p => p.id !== id))
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
    const currentPrice = livePrices[p.ticker] ?? etf.price // 실시간 가격 우선
    const usdInvested = (p.amountKRW * 10000) / p.fxRate
    const shares = usdInvested / purchasePrice
    const currentValueKRW = shares * currentPrice * currentFxRate
    // 수익률: 주가 변동만 (환율 효과 제거)
    const gainPct = (currentPrice - purchasePrice) / purchasePrice * 100
    const gainKRW = currentValueKRW - p.amountKRW * 10000
    return { currentValueKRW, gainKRW, gainPct }
  }

  // ── 주가 차트 데이터 생성 (실제 주가, 정규화) ──
  function buildPriceChartData() {
    const tickers = [...new Set(purchases.map(p => p.ticker))]
    const periodHistory = priceHistoryByPeriod[chartPeriod] ?? {}
    if (tickers.length === 0) return null
    if (tickers.some(t => !periodHistory[t])) return null // 로딩 중

    // 모든 날짜 수집 후 정렬
    const allDatesSet = new Set<string>()
    tickers.forEach(t => periodHistory[t]?.forEach(d => allDatesSet.add(d.date)))
    const allDates = [...allDatesSet].sort()
    if (allDates.length === 0) return null

    // 첫 종가 기준 정규화 (% 변동)
    const firstClose: Record<string, number> = {}
    tickers.forEach(t => {
      const h = periodHistory[t]
      if (h?.length) firstClose[t] = h[0].close
    })

    // 날짜별 빠른 조회 테이블
    const lookup: Record<string, Record<string, number>> = {}
    tickers.forEach(t => {
      lookup[t] = {}
      periodHistory[t]?.forEach(d => { lookup[t][d.date] = d.close })
    })

    const data = allDates.map(date => {
      const row: Record<string, any> = { date }
      tickers.forEach(t => {
        const close = lookup[t][date]
        if (close != null && firstClose[t]) {
          row[t] = Math.round(((close / firstClose[t]) - 1) * 1000) / 10 // % change, 소수 1자리
          row[`${t}_price`] = close
        }
      })
      return row
    })

    // 매수일별 그룹핑 (ReferenceLine 중복 방지)
    const purchasesByDate = purchases.reduce<Record<string, string[]>>((acc, p) => {
      if (!acc[p.date]) acc[p.date] = []
      if (!acc[p.date].includes(p.ticker)) acc[p.date].push(p.ticker)
      return acc
    }, {})

    return { data, tickers, purchasesByDate }
  }

  const totalInvested = purchases.reduce((s, p) => s + p.amountKRW * 10000, 0)
  const totalCurrent = purchases.reduce((s, p) => s + calcReturn(p).currentValueKRW, 0)
  const totalGainPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0

  const tickerSummary = purchases.reduce<Record<string, { invested: number; current: number; totalUSD: number; totalShares: number }>>((acc, p) => {
    const etf = ETF_DATA[p.ticker]
    const { currentValueKRW } = calcReturn(p)
    const purchasePrice = p.etfPrice ?? etf.price
    const usdInvested = (p.amountKRW * 10000) / p.fxRate
    const shares = usdInvested / purchasePrice
    if (!acc[p.ticker]) acc[p.ticker] = { invested: 0, current: 0, totalUSD: 0, totalShares: 0 }
    acc[p.ticker].invested += p.amountKRW * 10000
    acc[p.ticker].current += currentValueKRW
    acc[p.ticker].totalUSD += usdInvested
    acc[p.ticker].totalShares += shares
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
            {!isLoggedIn ? (
              <div className="card p-10 text-center">
                <div className="text-3xl mb-3">🔒</div>
                <div className="text-slate-600 text-sm font-medium mb-1">로그인이 필요한 기능이에요</div>
                <div className="text-slate-400 text-xs mb-4">포트폴리오 저장/불러오기는 로그인 후 이용할 수 있어요</div>
                <Link href="/login" className="inline-block text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl transition-colors">
                  로그인하기
                </Link>
              </div>
            ) : loadingPF ? (
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
            {loadingRecords && (
              <div className="text-center py-8 text-slate-400 text-sm animate-pulse">불러오는 중...</div>
            )}
            {!loadingRecords && <>
            {/* 동기화 상태 배너 */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl text-xs text-green-600">
                <span>☁️</span>
                <span>클라우드 동기화 중 · <span className="font-medium">{session?.user?.email}</span></span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-100 rounded-xl">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>💾</span>
                  <span>이 기기에만 저장됩니다 · 로그인하면 모든 기기에서 동기화</span>
                </div>
                <Link href="/login" className="text-xs font-medium text-blue-600 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors">
                  로그인
                </Link>
              </div>
            )}
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
                      <div className="space-y-3">
                        {Object.entries(tickerSummary).map(([t, v]) => {
                          const gainPct = ((v.current - v.invested) / v.invested) * 100
                          const weight = totalCurrent > 0 ? (v.current / totalCurrent) * 100 : 0
                          const etf = ETF_DATA[t]
                          const avgPrice = v.totalShares > 0 ? v.totalUSD / v.totalShares : null
                          const currentPrice = livePrices[t] ?? etf?.price
                          const avgPriceGainPct = avgPrice && currentPrice ? ((currentPrice - avgPrice) / avgPrice) * 100 : null
                          return (
                            <div key={t}>
                              <div className="flex items-center gap-3 mb-1">
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
                              {avgPrice !== null && avgPriceGainPct !== null && (
                                <div className="ml-5 text-xs text-slate-400">
                                  평균단가 <span className="text-slate-600 font-medium">${avgPrice.toFixed(2)}</span>
                                  {' · '}
                                  주가 기준
                                  <span className={`font-semibold ml-1 ${avgPriceGainPct >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                    {avgPriceGainPct >= 0 ? '+' : ''}{avgPriceGainPct.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 주가 차트 (1년 실제 주가) ── */}
                {(() => {
                  if (purchases.length === 0) return (
                    <div className="card p-6 text-center text-xs text-slate-400">
                      매수 기록을 추가하면 주가 차트가 표시됩니다
                    </div>
                  )
                  if (chartLoading) return (
                    <div className="card p-6 text-center text-xs text-slate-400 animate-pulse">
                      주가 데이터 로딩 중...
                    </div>
                  )
                  const chartResult = buildPriceChartData()
                  if (!chartResult) return null
                  const { data, tickers, purchasesByDate } = chartResult
                  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
                  // 기간별 X축 틱 간격 & 날짜 포맷
                  const xTickInterval: Record<string, number> = { '1M': 7, '6M': 21, '1Y': 42, '5Y': 26, '10Y': 52 }
                  const xTickFmt: Record<string, (d: string) => string> = {
                    '1M':  d => d.slice(5).replace('-', '/'),   // MM/DD
                    '6M':  d => d.slice(2, 7).replace('-', '.'), // YY.MM
                    '1Y':  d => d.slice(2, 7).replace('-', '.'), // YY.MM
                    '5Y':  d => d.slice(0, 4),                  // YYYY
                    '10Y': d => d.slice(0, 4),                  // YYYY
                  }
                  const xInterval = xTickInterval[chartPeriod] ?? 21
                  const xFmt = xTickFmt[chartPeriod] ?? (d => d.slice(0, 7))
                  const periods: ('1M'|'6M'|'1Y'|'5Y'|'10Y')[] = ['1M','6M','1Y','5Y','10Y']
                  return (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-slate-700">주가 추이</h3>
                        <div className="flex gap-1">
                          {periods.map(p => (
                            <button key={p} onClick={() => setChartPeriod(p)}
                              className={`text-xs px-2 py-0.5 rounded-md font-medium transition-all ${
                                chartPeriod === p
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                              }`}
                            >{p}</button>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">기간 시작 대비 % 변동 · Yahoo Finance 실제 종가</p>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={xFmt}
                            interval={xInterval}
                            height={40}
                            angle={-45}
                            tick={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'end' }}
                          />
                          <YAxis
                            tickFormatter={fmtPct}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            width={52}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              return (
                                <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                                  <div style={{ color: '#64748b', marginBottom: 4 }}>{label}</div>
                                  {payload.filter((p: any) => !String(p.dataKey).includes('_')).map((p: any) => (
                                    <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between', minWidth: 140 }}>
                                      <span className="font-semibold">{p.dataKey}</span>
                                      <span>${p.payload[`${p.dataKey}_price`]?.toFixed(2)}</span>
                                      <span>{p.value >= 0 ? '+' : ''}{p.value?.toFixed(1)}%</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                          {/* 매수일 세로 점선 */}
                          {Object.entries(purchasesByDate).map(([date, tkrs]) => (
                            <ReferenceLine
                              key={date} x={date}
                              stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1.5}
                              label={{ value: tkrs.join('/'), position: 'insideTopRight', fontSize: 8, fill: '#94a3b8' }}
                            />
                          ))}
                          {tickers.map(t => (
                            <Line key={t} type="monotone" dataKey={t}
                              stroke={ETF_DATA[t]?.color ?? '#94a3b8'}
                              strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                              connectNulls isAnimationActive={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}

                <p className="text-xs text-slate-400 text-center">
                  * 현재 기준가 + 실시간 환율 기반 추정치
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
            </>}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
