'use client'
import { YearResult } from '@/types'
import { fmtKRW } from '@/lib/simulator'

interface Props {
  result: YearResult
  taxEnabled: boolean
}

export default function TaxSummary({ result, taxEnabled }: Props) {
  const t = result.tax
  if (!taxEnabled) return null

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">세금 상세 분석</h3>
        <span className="text-xs text-slate-400">{result.year}년차 기준</span>
      </div>

      {/* 배당 세금 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">배당소득세</div>

        <TaxRow label="세전 연 배당금" value={fmtKRW(result.annualDivKRW)} />
        <TaxRow label="미국 원천징수 15%" value={`-${fmtKRW(t.withholdingTaxKRW)}`} negative />
        {t.surchargeKRW > 0 && (
          <TaxRow label="종소세 추가 납부" value={`-${fmtKRW(t.surchargeKRW)}`} negative />
        )}
        <div className="border-t border-slate-100 pt-2">
          <TaxRow label="세후 연 배당금" value={fmtKRW(t.afterTaxDivKRW)} highlight />
          <TaxRow label="세후 월 배당금" value={fmtKRW(t.afterTaxMonthlyDivKRW)} highlight />
        </div>
      </div>

      {/* 종합과세 초과 경고 */}
      {t.exceedsThreshold && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-sm font-semibold text-orange-700">금융소득 종합과세 대상</div>
              <div className="text-xs text-orange-600 mt-0.5">
                연 금융소득 {fmtKRW(t.financialIncomeKRW)} → 2,000만원 초과<br/>
                초과분에 종합소득세율 적용, 추가 납부 {fmtKRW(t.surchargeKRW)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 건강보험 경고 */}
      {t.healthInsuranceRisk && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">🏥</span>
            <div>
              <div className="text-sm font-semibold text-red-700">건보 피부양자 탈락 위험</div>
              <div className="text-xs text-red-600 mt-0.5">
                금융소득 연 2,000만원 초과 시 피부양자 자격 상실<br/>
                직장가입자 피부양자라면 별도 지역가입자 보험료 납부 필요
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 양도세 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">양도소득세 (매도 시)</div>
        <TaxRow label="누적 평가차익" value={fmtKRW(result.gainKRW)} />
        <TaxRow label="250만원 기본공제 후 양도세 22%" value={`-${fmtKRW(t.capitalGainsTaxKRW)}`} negative />
        <div className="border-t border-slate-100 pt-2">
          <TaxRow label="세후 실현 차익" value={fmtKRW(t.afterTaxGainKRW)} highlight />
        </div>
      </div>

      {/* 총 세금 요약 */}
      <div className="bg-slate-50 rounded-xl p-3">
        <div className="text-xs font-semibold text-slate-500 mb-2">연간 세금 총합</div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">배당세 + 종소세</span>
          <span className="text-sm font-bold text-red-600">-{fmtKRW(t.totalDivTaxKRW)}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-slate-400">세금 부담률</span>
          <span className="text-xs font-semibold text-slate-600">
            {result.annualDivKRW > 0
              ? ((t.totalDivTaxKRW / result.annualDivKRW) * 100).toFixed(1)
              : 0}%
          </span>
        </div>
      </div>
    </div>
  )
}

function TaxRow({ label, value, negative, highlight }: {
  label: string; value: string; negative?: boolean; highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-xs ${highlight ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold ${
        negative ? 'text-red-500' : highlight ? 'text-blue-600' : 'text-slate-700'
      }`}>
        {value}
      </span>
    </div>
  )
}
