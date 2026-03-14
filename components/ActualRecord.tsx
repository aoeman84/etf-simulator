'use client'
import { useState } from 'react'
import { ETF_DATA, fmtKRW } from '@/lib/simulator'

interface Purchase {
  id: string
  date: string
  ticker: string
  amountKRW: number  // 투자금 (만원)
  fxRate: number
}

export default function ActualRecord() {
  const [open, setOpen] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [form, setForm] = useState({ date: '', ticker: 'SCHD', amount: '', fxRate: '1350' })

  function addPurchase() {
    if (!form.date || !form.amount) return
    setPurchases(prev => [...prev, {
      id: Date.now().toString(),
      date: form.date,
      ticker: form.ticker,
      amountKRW: Number(form.amount),
      fxRate: Number(form.fxRate),
    }])
    setForm(f => ({ ...f, date: '', amount: '' }))
  }

  function removePurchase(id: string) {
    setPurchases(prev => prev.filter(p => p.id !== id))
  }

  // 현재 수익률 계산 (현재 주가 기준)
  function calcReturn(p: Purchase) {
    const etf = ETF_DATA[p.ticker]
    const currentPrice = etf.price  // 기준가 (실시간 미반영)
    const usdInvested = (p.amountKRW * 10000) / p.fxRate
    const sharesNow = usdInvested / currentPrice  // 단순화 (분할매수 미고려)
    const currentValueKRW = sharesNow * currentPrice * 1350
    const gainPct = ((currentValueKRW - p.amountKRW * 10000) / (p.amountKRW * 10000)) * 100
    return { currentValueKRW, gainPct }
  }

  const totalInvested = purchases.reduce((s, p) => s + p.amountKRW * 10000, 0)
  const totalCurrent = purchases.reduce((s, p) => s + calcReturn(p).currentValueKRW, 0)
  const totalGainPct = totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all">
        📒 실제 기록
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold">📒 실제 투자 기록</h2>
                <button onClick={() => setOpen(false)} className="text-slate-400 text-xl leading-none">✕</button>
              </div>
              <p className="text-xs text-slate-500 mb-4">실제 매수 내역을 입력해 현재 수익률을 확인하세요.</p>

              {/* 입력 폼 */}
              <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-0.5 block">날짜</label>
                    <input type="date" value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="input text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-0.5 block">ETF</label>
                    <select className="input text-sm" value={form.ticker}
                      onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}>
                      {Object.keys(ETF_DATA).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-0.5 block">투자금액 (만원)</label>
                    <input type="number" placeholder="500" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      className="input text-sm" inputMode="numeric" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-0.5 block">당시 환율</label>
                    <input type="number" placeholder="1350" value={form.fxRate}
                      onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))}
                      className="input text-sm" inputMode="numeric" />
                  </div>
                </div>
                <button onClick={addPurchase} className="btn-primary w-full text-sm">+ 추가</button>
              </div>

              {/* 매수 내역 */}
              {purchases.length > 0 ? (
                <>
                  <div className="space-y-2 mb-4">
                    {purchases.map(p => {
                      const { currentValueKRW, gainPct } = calcReturn(p)
                      return (
                        <div key={p.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-semibold">{p.ticker}</span>
                              <span className="text-slate-400 text-xs">{p.date}</span>
                              <span className="text-slate-600">{p.amountKRW.toLocaleString()}만원</span>
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

                  {/* 합계 */}
                  <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-xs text-slate-400">총 투자금</div>
                      <div className="text-sm font-bold text-slate-700">{fmtKRW(totalInvested)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">현재 평가액</div>
                      <div className="text-sm font-bold text-blue-600">{fmtKRW(totalCurrent)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">수익률</div>
                      <div className={`text-sm font-bold ${totalGainPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-2">* 현재 기준가 기반 추정치 · 실제와 다를 수 있음</p>
                </>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  매수 내역을 추가해보세요
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
