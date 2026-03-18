'use client'
import { useState, useEffect, ReactNode } from 'react'
import { ETF_DATA } from '@/lib/simulator'

export interface ETFAllocation {
  ticker: string
  monthly: number
}

interface Props {
  allocations: ETFAllocation[]
  onChange: (allocations: ETFAllocation[]) => void
  actionSlot?: ReactNode  // ← 헤더 오른쪽에 배치할 아이콘 버튼들
}

interface PriceInfo {
  price: number
  change: number | null
  changePct: number | null
}

function useLivePrices(tickers: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    tickers.forEach(ticker => {
      setLoading(prev => ({ ...prev, [ticker]: true }))
      fetch(`/api/etf-price?ticker=${ticker}`)
        .then(r => r.json())
        .then(d => {
          if (d.price) {
            setPrices(prev => ({
              ...prev,
              [ticker]: {
                price: d.price,
                change: d.change ?? null,
                changePct: d.changePct ?? null,
              }
            }))
          }
        })
        .finally(() => setLoading(prev => ({ ...prev, [ticker]: false })))
    })
  }, [tickers.join(',')])

  return { prices, loading }
}

function MonthlyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [inputVal, setInputVal] = useState(String(value))
  useEffect(() => { setInputVal(String(value)) }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setInputVal(raw)
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num >= 10 && num <= 2000) onChange(num)
  }
  function handleBlur() {
    const num = parseInt(inputVal, 10)
    const clamped = isNaN(num) ? 10 : Math.min(2000, Math.max(10, num))
    setInputVal(String(clamped))
    onChange(clamped)
  }

  return (
    <input type="number" min={10} max={2000} step={10} value={inputVal}
      onChange={handleChange} onBlur={handleBlur}
      className="w-16 text-right border border-slate-200 rounded-xl px-2 py-1 text-sm font-semibold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
      inputMode="numeric" />
  )
}

export default function MultiETF({ allocations, onChange, actionSlot }: Props) {
  const activeTickers = allocations.map(a => a.ticker)
  const { prices, loading } = useLivePrices(activeTickers)

  function toggleETF(ticker: string) {
    const exists = allocations.find(a => a.ticker === ticker)
    if (exists) {
      if (allocations.length === 1) return
      onChange(allocations.filter(a => a.ticker !== ticker))
    } else {
      onChange([...allocations, { ticker, monthly: 100 }])
    }
  }

  function updateMonthly(ticker: string, value: number) {
    onChange(allocations.map(a => a.ticker === ticker ? { ...a, monthly: value } : a))
  }

  const total = allocations.reduce((s, a) => s + a.monthly, 0)

  return (
    <div className="space-y-3">
      <div>
        {/* 헤더: "ETF 선택 (복수 가능)" + 오른쪽에 actionSlot */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">ETF 선택 (복수 가능)</label>
          {actionSlot && <div className="flex items-center gap-1.5">{actionSlot}</div>}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.keys(ETF_DATA).map(t => {
            const active = allocations.some(a => a.ticker === t)
            const etfMeta = ETF_DATA[t]
            return (
              <div key={t} className="relative group">
                <button onClick={() => toggleETF(t)}
                  className={`w-full py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    active
                      ? 'border-blue-400 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}>
                  {t}
                </button>
                {etfMeta.tooltip && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 hidden group-hover:block z-10 leading-relaxed pointer-events-none">
                    {etfMeta.tooltip}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        {allocations.map(a => {
          const etf = ETF_DATA[a.ticker]
          const pct = total > 0 ? Math.round((a.monthly / total) * 100) : 0
          const info = prices[a.ticker]

          return (
            <div key={a.ticker} className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: etf.color }} />
                <span className="text-sm font-semibold">{a.ticker}</span>
                <span className="text-xs text-slate-400 flex-1 truncate">{etf.name}</span>
                <span className="text-xs font-medium text-blue-600 flex-shrink-0">{pct}%</span>
              </div>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {loading[a.ticker] ? (
                  <span className="text-xs text-slate-400">조회 중...</span>
                ) : info ? (
                  <>
                    <span className="text-xs text-slate-500">현재기준가</span>
                    <span className="text-xs font-semibold text-slate-700">${info.price.toFixed(2)}</span>
                    {info.changePct !== null ? (
                      <>
                        <span className={`text-xs font-semibold ${info.changePct >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                          {info.changePct >= 0 ? '▲' : '▼'} {Math.abs(info.changePct).toFixed(2)}%
                        </span>
                        <span className={`text-xs ${info.changePct >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                          ({info.changePct >= 0 ? '+' : ''}{info.change?.toFixed(2)})
                        </span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-500">현재기준가</span>
                    <span className="text-xs font-semibold text-slate-700">${etf.price.toFixed(2)}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input type="range" min={10} max={2000} step={10} value={a.monthly}
                  onChange={e => updateMonthly(a.ticker, Number(e.target.value))}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchMove={e => e.stopPropagation()}
                  className="flex-1 accent-blue-600" style={{ height: '28px' }} />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <MonthlyInput value={a.monthly} onChange={v => updateMonthly(a.ticker, v)} />
                  <span className="text-xs text-slate-500">만</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between items-center px-1">
        <span className="text-sm text-slate-500">총 월 투자금액</span>
        <span className="text-sm font-bold text-blue-600">{total.toLocaleString()}만원</span>
      </div>
    </div>
  )
}
