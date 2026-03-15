'use client'
import { useState, useEffect } from 'react'
import { TaxSettings } from '@/types'
import { DEFAULT_TAX } from '@/lib/tax'

interface Props {
  tax: TaxSettings
  onChange: (t: TaxSettings) => void
}

// 슬라이더 0 → 0원 / 50 → 8,800만원 / 100 → 12억
const ANCHOR_MID = 88_000_000
const ANCHOR_MAX = 1_200_000_000
const MIN_INCOME = 1_000_000

function sliderToIncome(v: number): number {
  if (v <= 0) return 0
  if (v >= 100) return ANCHOR_MAX
  if (v <= 50) {
    const t = v / 50
    return Math.round(MIN_INCOME * Math.pow(ANCHOR_MID / MIN_INCOME, t))
  }
  const t = (v - 50) / 50
  return Math.round(ANCHOR_MID * Math.pow(ANCHOR_MAX / ANCHOR_MID, t))
}

function incomeToSlider(income: number): number {
  if (income <= 0) return 0
  if (income >= ANCHOR_MAX) return 100 // 12억 초과도 슬라이더는 100 고정
  if (income <= ANCHOR_MID) {
    if (income < MIN_INCOME) return 0
    return Math.round(Math.log(income / MIN_INCOME) / Math.log(ANCHOR_MID / MIN_INCOME) * 50)
  }
  return Math.round(50 + Math.log(income / ANCHOR_MID) / Math.log(ANCHOR_MAX / ANCHOR_MID) * 50)
}

function fmtIncome(v: number): string {
  if (v === 0) return '0원'
  const eok = Math.floor(v / 1e8)
  const man = Math.floor((v % 1e8) / 1e4)
  if (eok > 0 && man > 0) return `${eok}억 ${man}만원`
  if (eok > 0) return `${eok}억원`
  return `${man}만원`
}

function getBracket(income: number): { rate: string; color: string } {
  if (income <= 0)               return { rate: '-',   color: 'bg-slate-100 text-slate-400' }
  if (income <= 14_000_000)     return { rate: '6%',  color: 'bg-slate-100 text-slate-500' }
  if (income <= 50_000_000)     return { rate: '15%', color: 'bg-slate-100 text-slate-500' }
  if (income <= 88_000_000)     return { rate: '24%', color: 'bg-blue-100 text-blue-600' }
  if (income <= 150_000_000)    return { rate: '35%', color: 'bg-amber-100 text-amber-600' }
  if (income <= 300_000_000)    return { rate: '38%', color: 'bg-orange-100 text-orange-600' }
  if (income <= 500_000_000)    return { rate: '40%', color: 'bg-orange-200 text-orange-700' }
  if (income <= 1_000_000_000)  return { rate: '42%', color: 'bg-red-100 text-red-600' }
  return { rate: '45%', color: 'bg-red-200 text-red-700' }
}

// 눈금 (슬라이더 위치값 사전 계산)
const TICKS = [
  { label: '0',      pos: 0   },
  { label: '1,400만', pos: 29  },
  { label: '5,000만', pos: 44  },
  { label: '8,800만', pos: 50  },
  { label: '1.5억',   pos: 60  },
  { label: '3억',     pos: 73  },
  { label: '5억',     pos: 83  },
  { label: '12억↑',   pos: 100 },
]

export default function TaxPanel({ tax, onChange }: Props) {
  function set<K extends keyof TaxSettings>(key: K, value: TaxSettings[K]) {
    onChange({ ...tax, [key]: value })
  }

  const otherIncome = tax.otherIncomeKRW ?? 0
  const sliderVal = incomeToSlider(otherIncome)
  const { rate, color } = getBracket(otherIncome)

  // 만원 단위 직접 입력 상태
  // ✅ 12억 초과 입력도 허용 (max 없음)
  const [inputMan, setInputMan] = useState(String(Math.round(otherIncome / 10000)))

  useEffect(() => {
    setInputMan(String(Math.round(otherIncome / 10000)))
  }, [otherIncome])

  function handleInputChange(raw: string) {
    setInputMan(raw)
    const n = parseInt(raw.replace(/,/g, ''), 10)
    if (!isNaN(n) && n >= 0) {
      set('otherIncomeKRW', n * 10000)
    }
  }

  function handleInputBlur() {
    const n = parseInt(inputMan.replace(/,/g, ''), 10)
    const val = isNaN(n) || n < 0 ? 0 : n
    setInputMan(String(val))
    set('otherIncomeKRW', val * 10000)
  }

  // 현재 슬라이더 위치에서 가장 가까운 눈금
  const nearestTickIdx = TICKS.reduce((best, tick, i) => {
    return Math.abs(sliderVal - tick.pos) < Math.abs(sliderVal - TICKS[best].pos) ? i : best
  }, 0)

  return (
    <div className="space-y-4">
      {/* 세금 계산 ON/OFF */}
      <div
        onClick={() => set('enabled', !tax.enabled)}
        className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
          tax.enabled ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}
      >
        <div>
          <div className="font-semibold text-sm">세금 계산 반영</div>
          <div className="text-xs opacity-70 mt-0.5">{tax.enabled ? '세후 실수령액 기준' : '세전 금액 기준'}</div>
        </div>
        <div className={`w-10 h-6 rounded-full transition-colors relative ${tax.enabled ? 'bg-red-400' : 'bg-slate-300'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${tax.enabled ? 'left-5' : 'left-1'}`} />
        </div>
      </div>

      {tax.enabled && (
        <div className="space-y-3">
          <div className="card p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">배당소득세</div>
            <CheckRow label="미국 원천징수세 15%" desc="SCHD 등 미국 ETF 배당금에서 자동 차감"
              checked={tax.withholdingTax} onChange={v => set('withholdingTax', v)} />
            <CheckRow label="금융소득 종합과세" desc="연 금융소득 2,000만원 초과 시 종합소득세 합산"
              checked={tax.comprehensiveIncomeTax} onChange={v => set('comprehensiveIncomeTax', v)} />

            {tax.comprehensiveIncomeTax && (
              <div className="pl-6 space-y-4 border-l-2 border-slate-100 ml-1">

                {/* 다른 금융소득 — max 2,000만원 */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-600">다른 금융소득 <span className="text-slate-400">(이자·기타 배당)</span></label>
                    <span className="text-xs font-semibold text-blue-600">
                      {((tax.otherFinancialIncomeKRW ?? 0) / 10000).toLocaleString()}만원/년
                    </span>
                  </div>
                  <input type="range" min={0} max={20_000_000} step={500_000}
                    value={tax.otherFinancialIncomeKRW ?? 0}
                    onChange={e => set('otherFinancialIncomeKRW', Number(e.target.value))}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                    <span>0원</span><span className="text-blue-500 font-medium">2,000만원</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">배당 + 이자 합산 2,000만원 초과 시 종합과세 대상</p>
                </div>

                {/* 다른 종합소득 — 로그 슬라이더 + 만원 직접 입력 */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-600">다른 종합소득 <span className="text-slate-400">(근로·사업소득)</span></label>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded transition-all ${color}`}>
                        {rate === '-' ? '미해당' : rate}
                      </span>
                    </div>
                  </div>

                  {/* ✅ 만원 단위 직접 입력 — 12억 초과도 허용 */}
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min={0}
                      value={inputMan}
                      onChange={e => handleInputChange(e.target.value)}
                      onBlur={handleInputBlur}
                      className="w-28 text-right border border-slate-200 rounded-lg px-2 py-1 text-sm font-semibold text-orange-600 outline-none focus:ring-2 focus:ring-orange-400"
                      inputMode="numeric"
                      placeholder="0"
                    />
                    <span className="text-xs text-slate-500">만원/년</span>
                    <span className="text-xs text-slate-400 ml-auto">
                      = {fmtIncome(otherIncome)}
                    </span>
                  </div>

                  {/* 로그 슬라이더 (12억 이상이면 100 고정) */}
                  <input type="range" min={0} max={100} step={1}
                    value={sliderVal}
                    onChange={e => set('otherIncomeKRW', sliderToIncome(Number(e.target.value)))}
                    className="w-full accent-orange-500" />

                  {/* 동적 눈금 */}
                  <div className="flex justify-between mt-2">
                    {TICKS.map((tick, i) => (
                      <div key={tick.label} className="flex flex-col items-center gap-0.5">
                        <div className={`w-px h-2 rounded-full transition-colors ${
                          i === nearestTickIdx ? 'bg-orange-400' : 'bg-slate-200'
                        }`} />
                        <span className={`text-xs transition-all leading-tight ${
                          i === nearestTickIdx ? 'text-orange-500 font-semibold' : 'text-slate-300'
                        }`}>
                          {tick.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-slate-400 mt-1.5">
                    슬라이더 중간 = 8,800만원 · 직접 입력 시 12억 초과 가능
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="text-xs font-semibold text-blue-700 mb-1">📊 세율 자동 계산</div>
                  <div className="text-xs text-blue-600 leading-relaxed">
                    금융소득 2,000만원 초과분 + 근로·사업소득 합산 후<br />
                    한국 누진세 구간을 자동으로 적용합니다
                    <span className="text-blue-400 mt-1 block">6% → 15% → 24% → 35% → 38% → 40% → 42% → 45%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">건강보험</div>
            <CheckRow label="피부양자 탈락 경고" desc="금융소득 연 2,000만원 초과 시 피부양자 자격 상실"
              checked={tax.healthInsurance} onChange={v => set('healthInsurance', v)} />
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">양도소득세</div>
            <CheckRow label="해외주식 양도세 22%" desc="매도 시 차익에서 250만원 공제 후 22% (지방세 포함)"
              checked={tax.capitalGainsTax} onChange={v => set('capitalGainsTax', v)} />
          </div>

          <button onClick={() => onChange(DEFAULT_TAX)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            ↺ 기본값으로 초기화
          </button>
        </div>
      )}
    </div>
  )
}

function CheckRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start gap-3 cursor-pointer" onClick={() => onChange(!checked)}>
      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
        checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
      }`}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
      </div>
    </div>
  )
}
