'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ETF_DATA, fmtKRW } from '@/lib/simulator'

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
  currentPrice?: number
  currentFxRate?: number
}

type SubTab = 'saved' | 'records'

export default function PortfolioPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const [subTab, setSubTab] = useState<SubTab>('saved')

  // 저장된 포트폴리오
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([])
  const [loadingPF, setLoadingPF] = useState(true)

  // 실제 매수 기록 (localStorage 저장)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [form, setForm] = useState({ date: '', ticker: 'SCHD', amount: '', fxRate: '1350' })
  const [currentFxRate, setCurrentFxRate] = useState(1350)

  // 저장된 포트폴리오 불러오기
  useEffect(() => {
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(data => { setPortfolios(data); setLoadingPF(false) })
      .catch(() => setLoadingPF(false))
  }, [])

  // 실제 기록 localStorage 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem('etf_actual_records')
      if (saved) setPurchases(JSON.parse(saved))
    } catch {}
  }, [])

  // 실시간 환율
  useEffect(() => {
    fetch('/api/fx-rate').then(r => r.json()).then(d => {
      if (d.rate) setCurrentFxRate(d.rate)
    }).catch(() => {})
  }, [])

  // 매수 기록 저장 (localStorage)
  function savePurchases(list: Purchase[]) {
    setPurchases(list)
    try { localStorage.setItem('etf_actual_records', JSON.stringify(list)) } catch {}
  }

  function addPurchase() {
    if (!form.date || !form.amount) return
    const next = [...purchases, {
      id: Date.now().toString(),
      date: form.date,
      ticker: form.ticker,
      amountKRW: Number(form.amount),
      fxRate: Number(form.fxRate),
    }]
    savePurchases(next)
    setForm(f => ({ ...f, date: '', amount: '' }))
  }

  function removePurchase(id: string) {
    savePurchases(purchases.filter(p => p.id !== id))
  }

  async function deletePortfolio(id: string) {
    await fetch(`/api/portfolio/${id}`, { method: 'DELETE' })
    setPortfolios(prev => prev.filter(p => p.id !== id))
  }

  // 수익률 계산 (현재 실시간 환율 반영)
  function calcReturn(p: Purchase) {
    const etf = ETF_DATA[p.ticker]
    const usdInvested = (p.amountKRW * 10000) / p.fxRate
    const shares = usdInvested / etf.price
    const currentValueKRW = shares * etf.price * currentFxRate
    const gainKRW = currentValueKRW - p.amountKRW * 10000
    const gainPct = (gainKRW / (p.amountKRW * 10000)) * 100
    return { currentValueKRW, gainKRW, gainPct }
  }

  const totalInvested = purchases.reduce((s, p) => s + p.amountKRW * 10000, 0)
  const totalCurrent = purchases.reduce((s, p) => s + calcReturn(p).currentValueKRW, 0)
  const totalGainPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0

  // 티커별 집계
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
      <main className="max-w-4xl mx-auto px-4 py-4">

        {/* 서브 탭 */}
        <div className="flex bg-white rounded-xl border border-slate-200 p-1 gap-1 mb-5">
          <SubTabBtn active={subTab === 'saved'} onClick={() => setSubTab('saved')}>
            💾 저장된 포트폴리오
          </SubTabBtn>
          <SubTabBtn active={subTab === 'records'} onClick={() => setSubTab('records')}>
            📒 실제 매수 기록
            {purchases.length > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                {purchases.length}
              </span>
            )}
          </SubTabBtn>
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
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-800 mb-1">{pf.name}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(pf.createdAt).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                          })} 저장
                        </div>
                        {pf.settings?.allocations && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
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
                                {{ optimistic:'🟢 낙관', neutral:'🟡 중립', pessimistic:'🔴 비관', custom:'⚙️ 직접' }[pf.settings.scenario.mode as string] ?? pf.settings.scenario.mode}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => deletePortfolio(pf.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors text-xl leading-none flex-shrink-0 mt-0.5"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── 실제 매수 기록 ─── */}
        {subTab === 'records' && (
          <div className="space-y-4">

            {/* 입력 폼 */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">매수 내역 추가</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">날짜</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="input text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">ETF</label>
                  <select className="input text-sm" value={form.ticker}
                    onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}>
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
                  <label className="text-xs text-slate-500 mb-1 block">당시 환율</label>
                  <input type="number" placeholder="1350" value={form.fxRate}
                    onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))}
                    className="input text-sm" inputMode="numeric" />
                </div>
              </div>
              <button onClick={addPurchase}
                disabled={!form.date || !form.amount}
                className="btn-primary w-full text-sm disabled:opacity-40">
                + 추가
              </button>
            </div>

            {/* 총 요약 */}
            {purchases.length > 0 && (
              <>
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-700">전체 요약</h3>
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

                  {/* 티커별 비중 */}
                  {Object.keys(tickerSummary).length > 1 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-2">ETF별 현황</div>
                      <div className="space-y-2">
                        {Object.entries(tickerSummary).map(([t, v]) => {
                          const gainPct = ((v.current - v.invested) / v.invested) * 100
                          const weight = (v.current / totalCurrent) * 100
                          const etf = ETF_DATA[t]
                          return (
                            <div key={t} className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: etf?.color ?? '#94a3b8' }} />
                              <span className="text-sm font-medium w-12">{t}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full"
                                  style={{ width: `${weight}%`, background: etf?.color ?? '#94a3b8' }} />
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

                {/* 개별 내역 */}
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-sm font-medium text-slate-700">매수 내역</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {purchases
                      .slice()
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map(p => {
                        const { currentValueKRW, gainPct } = calcReturn(p)
                        return (
                          <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: ETF_DATA[p.ticker]?.color ?? '#94a3b8' }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold">{p.ticker}</span>
                                <span className="text-slate-400 text-xs">{p.date}</span>
                                <span className="text-slate-600">{p.amountKRW.toLocaleString()}만원</span>
                                <span className="text-slate-300 text-xs">{p.fxRate.toLocaleString()}원</span>
                              </div>
                              <div className="flex gap-3 text-xs mt-0.5">
                                <span className="text-slate-400">현재 {fmtKRW(currentValueKRW)}</span>
                                <span className={gainPct >= 0 ? 'text-blue-500 font-semibold' : 'text-red-500 font-semibold'}>
                                  {gainPct >= 0 ? '▲' : '▼'} {Math.abs(gainPct).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                            <button onClick={() => removePurchase(p.id)}
                              className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">
                              ✕
                            </button>
                          </div>
                        )
                      })}
                  </div>
                </div>
                <p className="text-xs text-slate-400 text-center">
                  * 현재 기준가 + 실시간 환율 기반 추정치 · 실제와 다를 수 있음 · 기록은 이 기기 브라우저에 저장됩니다
                </p>
              </>
            )}

            {purchases.length === 0 && (
              <div className="card p-10 text-center">
                <div className="text-3xl mb-3">📒</div>
                <div className="text-slate-500 text-sm mb-1">매수 내역을 추가해보세요</div>
                <div className="text-slate-400 text-xs">실제 투자 기록을 입력하면 현재 수익률을 확인할 수 있어요</div>
              </div>
            )}
          </div>
        )}

      </main>
      <Footer />
    </div>
  )
}

function SubTabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 text-sm py-2.5 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-1 ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
      }`}>
      {children}
    </button>
  )
}
