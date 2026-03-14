'use client'
import { useState } from 'react'
import { ETF_DATA } from '@/lib/simulator'

export default function InfoModal() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-blue-500 transition-colors ml-1"
        title="수익률 근거 보기"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"/>
          <path d="M6.75 7.25A.75.75 0 017.5 6.5h1a.75.75 0 01.75.75v3.25h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25V8h-.25a.75.75 0 01-.75-.75zM8 4a1 1 0 100 2 1 1 0 000-2z"/>
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">📊 수익률 계산 근거</h2>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
              </div>

              <div className="space-y-5">
                {/* 데이터 출처 */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">데이터 출처</div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    본 시뮬레이터의 수익률은 각 ETF의 <strong>실제 역사적 데이터(Historical Data)</strong>를 기반으로 합니다.
                    출처: Yahoo Finance, Schwab Asset Management, DRIPCalc.com
                  </p>
                </div>

                {/* ETF별 수익률 */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">ETF별 역사적 수익률</div>
                  <div className="space-y-3">
                    {Object.values(ETF_DATA).map(etf => (
                      <div key={etf.ticker} className="border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: etf.color }} />
                          <span className="font-semibold text-sm">{etf.ticker}</span>
                          <span className="text-xs text-slate-400">{etf.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-400 mb-0.5">주가 CAGR</div>
                            <div className="font-semibold text-green-600">{etf.priceCAGR}%</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-400 mb-0.5">배당 수익률</div>
                            <div className="font-semibold text-amber-600">{etf.divYield}%</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-400 mb-0.5">배당 성장</div>
                            <div className="font-semibold text-blue-600">{etf.divGrowthCAGR}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 측정 기간 */}
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">측정 기간</div>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>• <strong>SCHD</strong>: 2011년 출시 ~ 2024년 (약 13년)</li>
                    <li>• <strong>VOO</strong>: 2010년 출시 ~ 2024년 (약 14년)</li>
                    <li>• <strong>QQQ</strong>: 1999년 출시 ~ 2024년 (약 25년)</li>
                    <li>• <strong>VYM</strong>: 2006년 출시 ~ 2024년 (약 18년)</li>
                    <li>• <strong>JEPI</strong>: 2020년 출시 ~ 2024년 (약 4년)</li>
                  </ul>
                </div>

                {/* 주의사항 */}
                <div className="bg-red-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">⚠️ 주의사항</div>
                  <ul className="text-sm text-slate-600 space-y-1 leading-relaxed">
                    <li>• 과거 수익률이 미래 수익률을 보장하지 않습니다</li>
                    <li>• 슬라이더로 수익률을 직접 조정해 보수적 시나리오도 확인하세요</li>
                    <li>• 환율 변동은 실제 수익에 큰 영향을 미칩니다</li>
                    <li>• 본 시뮬레이터는 투자 조언이 아닙니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
