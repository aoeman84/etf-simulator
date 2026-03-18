'use client'
import { useState } from 'react'
import { ETF_DATA, fmtKRW } from '@/lib/simulator'

export default function GoalCalculator() {
  const [open, setOpen] = useState(false)
  const [targetDiv, setTargetDiv] = useState(300)   // 목표 월 배당 (만원)
  const [ticker, setTicker] = useState('SCHD')
  const [years, setYears] = useState(10)
  const [fxRate] = useState(1350)
  const [drip] = useState(true)

  const etf = ETF_DATA[ticker]

  // 역산: 목표 월배당을 달성하기 위한 월 투자금 계산
  // 이진탐색으로 근사값 찾기
  function calcRequiredMonthly(): number {
    const targetAnnual = targetDiv * 10000 * 12  // 연 배당 목표 (원)
    let lo = 10, hi = 5000
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2
      const result = simulateSimple(mid, years, fxRate, drip)
      const lastDiv = result[result.length - 1]?.annualDiv ?? 0
      if (lastDiv < targetAnnual) lo = mid
      else hi = mid
    }
    return Math.ceil((lo + hi) / 2 / 10) * 10
  }

  function simulateSimple(monthlyMan: number, years: number, fx: number, drip: boolean) {
    const monthlyKRW = monthlyMan * 10000
    const results = []
    let shares = 0, invested = 0
    const startDiv = etf.price * (etf.divYield / 100)
    const priceG = etf.priceCAGR / 100
    const divG = etf.divGrowthCAGR / 100

    for (let y = 1; y <= years; y++) {
      const priceEnd = etf.price * Math.pow(1 + priceG, y)
      const divPerShare = startDiv * Math.pow(1 + divG, y - 1)
      let annualDivUSD = 0

      for (let m = 1; m <= 12; m++) {
        const priceM = etf.price * Math.pow(1 + priceG, (y - 1) + m / 12)
        shares += (monthlyKRW / fx) / priceM
        invested += monthlyKRW
        const mDiv = (shares * divPerShare) / 12
        annualDivUSD += mDiv
        if (drip) shares += (mDiv * fx * 0.85 / fx) / priceM
      }

      results.push({
        year: y,
        portfolio: shares * priceEnd * fx,
        annualDiv: annualDivUSD * fx,
        invested,
      })
    }
    return results
  }

  const required = calcRequiredMonthly()
  const preview = simulateSimple(required, years, fxRate, drip)
  const last = preview[preview.length - 1]

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all">
        🎯 목표 역산
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}>
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold">🎯 목표 월배당 역산</h2>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
              </div>
              <p className="text-xs text-slate-500 mb-4">목표 월 배당금을 입력하면 필요한 월 투자금을 계산해드려요.</p>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-slate-700">목표 월 배당금 (세전)</label>
                    <span className="text-sm font-bold text-amber-600">{targetDiv.toLocaleString()}만원/월</span>
                  </div>
                  <input type="range" min={50} max={2000} step={50} value={targetDiv}
                    onChange={e => setTargetDiv(Number(e.target.value))}
                    onTouchStart={e => e.stopPropagation()}
                    onTouchMove={e => e.stopPropagation()}
                    className="w-full accent-amber-500" />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                    <span>50만</span><span>1,000만</span><span>2,000만</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">ETF</label>
                    <select className="input text-sm"
                      value={ticker} onChange={e => setTicker(e.target.value)}>
                      {Object.keys(ETF_DATA).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">투자 기간</label>
                    <select className="input text-sm"
                      value={years} onChange={e => setYears(Number(e.target.value))}>
                      {[5,10,15,20,25,30].map(y => (
                        <option key={y} value={y}>{y}년</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 결과 */}
                <div className="bg-gradient-to-br from-blue-50 to-amber-50 rounded-2xl p-4 space-y-3">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 mb-1">필요한 월 투자금</div>
                    <div className="text-3xl font-black text-blue-600">{required.toLocaleString()}만원</div>
                    <div className="text-xs text-slate-400 mt-0.5">{years}년간 매월</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white rounded-xl p-2">
                      <div className="text-xs text-slate-400">총 투자원금</div>
                      <div className="text-sm font-bold text-slate-700">{fmtKRW(last?.invested ?? 0)}</div>
                    </div>
                    <div className="bg-white rounded-xl p-2">
                      <div className="text-xs text-slate-400">최종 포트폴리오</div>
                      <div className="text-sm font-bold text-blue-600">{fmtKRW(last?.portfolio ?? 0)}</div>
                    </div>
                    <div className="bg-white rounded-xl p-2">
                      <div className="text-xs text-slate-400">월 배당 달성</div>
                      <div className="text-sm font-bold text-amber-600">{fmtKRW((last?.annualDiv ?? 0) / 12)}</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    * {ticker} 역사적 수익률 기준 · DRIP 적용 · 세전
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
