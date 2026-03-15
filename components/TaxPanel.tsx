'use client'
import { TaxSettings } from '@/types'
import { DEFAULT_TAX } from '@/lib/tax'

interface Props {
  tax: TaxSettings
  onChange: (t: TaxSettings) => void
}

export default function TaxPanel({ tax, onChange }: Props) {
  function set<K extends keyof TaxSettings>(key: K, value: TaxSettings[K]) {
    onChange({ ...tax, [key]: value })
  }

  return (
    <div className="space-y-4">
      {/* 세금 계산 ON/OFF */}
      <div
        onClick={() => set('enabled', !tax.enabled)}
        className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all ${
          tax.enabled
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}
      >
        <div>
          <div className="font-semibold text-sm">세금 계산 반영</div>
          <div className="text-xs opacity-70 mt-0.5">
            {tax.enabled ? '세후 실수령액 기준' : '세전 금액 기준'}
          </div>
        </div>
        <div className={`w-10 h-6 rounded-full transition-colors relative ${tax.enabled ? 'bg-red-400' : 'bg-slate-300'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${tax.enabled ? 'left-5' : 'left-1'}`} />
        </div>
      </div>

      {tax.enabled && (
        <div className="space-y-3">
          {/* 배당소득세 */}
          <div className="card p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">배당소득세</div>
            <CheckRow
              label="미국 원천징수세 15%"
              desc="SCHD 등 미국 ETF 배당금에서 자동 차감"
              checked={tax.withholdingTax}
              onChange={v => set('withholdingTax', v)}
            />
            <CheckRow
              label="금융소득 종합과세"
              desc="연 금융소득 2,000만원 초과 시 종합소득세 합산"
              checked={tax.comprehensiveIncomeTax}
              onChange={v => set('comprehensiveIncomeTax', v)}
            />
            {tax.comprehensiveIncomeTax && (
              <div className="pl-6 space-y-3 border-l-2 border-slate-100 ml-1">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-600">다른 금융소득 (이자 등)</label>
                    <span className="text-xs font-semibold text-blue-600">
                      {(tax.otherIncomeKRW / 10000).toLocaleString()}만원/년
                    </span>
                  </div>
                  <input type="range" min={0} max={30000000} step={500000}
                    value={tax.otherIncomeKRW}
                    onChange={e => set('otherIncomeKRW', Number(e.target.value))}
                    className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                    <span>0원</span><span>3,000만원</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-slate-600 leading-tight">
                      종합소득세 한계세율
                    </label>
                    <span className="text-xs font-semibold text-red-600">{tax.marginalRate}%</span>
                  </div>
                  {/* 설명 추가 */}
                  <p className="text-xs text-slate-400 mb-2 leading-relaxed">
                    배당 <span className="font-medium text-slate-500">외</span> 근로·사업소득 기준으로 선택하세요.
                    배당 합산 후 구간이 달라질 수 있으니 여유 있게 선택 권장.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[15, 24, 35, 38, 40, 42, 45].map(r => (
                      <button key={r} onClick={() => set('marginalRate', r)}
                        className={`text-xs py-1.5 rounded-lg border transition-all ${
                          tax.marginalRate === r
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-slate-200 text-slate-600 hover:border-red-300'
                        }`}>
                        {r}%
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">
                    {tax.marginalRate <= 15 && '과세표준 1,400만원 이하'}
                    {tax.marginalRate === 24 && '과세표준 5,000만원 이하'}
                    {tax.marginalRate === 35 && '과세표준 8,800만원 이하'}
                    {tax.marginalRate === 38 && '과세표준 1.5억원 이하'}
                    {tax.marginalRate === 40 && '과세표준 3억원 이하'}
                    {tax.marginalRate === 42 && '과세표준 5억원 이하'}
                    {tax.marginalRate === 45 && '과세표준 5억원 초과'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 건강보험 */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">건강보험</div>
            <CheckRow
              label="피부양자 탈락 경고"
              desc="금융소득 연 2,000만원 초과 시 피부양자 자격 상실"
              checked={tax.healthInsurance}
              onChange={v => set('healthInsurance', v)}
            />
          </div>

          {/* 양도소득세 */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">양도소득세</div>
            <CheckRow
              label="해외주식 양도세 22%"
              desc="매도 시 차익에서 250만원 공제 후 22% (지방세 포함)"
              checked={tax.capitalGainsTax}
              onChange={v => set('capitalGainsTax', v)}
            />
          </div>

          {/* 초기화 */}
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
