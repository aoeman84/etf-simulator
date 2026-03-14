'use client'
import { ETF_DATA } from '@/lib/simulator'

export interface ETFAllocation {
  ticker: string
  monthly: number // 만원
}

interface Props {
  allocations: ETFAllocation[]
  onChange: (allocations: ETFAllocation[]) => void
}

export default function MultiETF({ allocations, onChange }: Props) {
  function toggleETF(ticker: string) {
    const exists = allocations.find(a => a.ticker === ticker)
    if (exists) {
      if (allocations.length === 1) return // 최소 1개
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
      {/* ETF 선택 버튼 */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">ETF 선택 (복수 가능)</label>
        <div className="grid grid-cols-5 gap-1.5">
          {Object.keys(ETF_DATA).map(t => {
            const active = allocations.some(a => a.ticker === t)
            return (
              <button key={t} onClick={() => toggleETF(t)}
                className={`py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  active
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}>
                {t}
              </button>
            )
          })}
        </div>
      </div>

      {/* ETF별 월 투자금 설정 */}
      <div className="space-y-2">
        {allocations.map(a => {
          const etf = ETF_DATA[a.ticker]
          const pct = total > 0 ? Math.round((a.monthly / total) * 100) : 0
          return (
            <div key={a.ticker} className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: etf.color }} />
                <span className="text-sm font-semibold">{a.ticker}</span>
                <span className="text-xs text-slate-400 flex-1 truncate">{etf.name}</span>
                <span className="text-xs font-medium text-blue-600 flex-shrink-0">{pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range" min={10} max={2000} step={10} value={a.monthly}
                  onChange={e => updateMonthly(a.ticker, Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                  style={{ height: '28px' }}
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number" min={10} max={2000} step={10} value={a.monthly}
                    onChange={e => {
                      const v = Math.min(2000, Math.max(10, Number(e.target.value)))
                      updateMonthly(a.ticker, isNaN(v) ? 10 : v)
                    }}
                    className="w-16 text-right border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
                    inputMode="numeric"
                  />
                  <span className="text-xs text-slate-500">만</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 총합 */}
      <div className="flex justify-between items-center px-1">
        <span className="text-sm text-slate-500">총 월 투자금액</span>
        <span className="text-sm font-bold text-blue-600">{total.toLocaleString()}만원</span>
      </div>
    </div>
  )
}
