'use client'
import { YearResult } from '@/types'
import { fmtKRW } from '@/lib/simulator'

interface Props {
  result: YearResult
  taxEnabled: boolean
  otherFinancialIncomeKRW?: number
}

function getTaxBracketLabel(income: number): string {
  if (income <= 0)             return '-'
  if (income <= 14_000_000)   return '6% 구간'
  if (income <= 50_000_000)   return '15% 구간'
  if (income <= 88_000_000)   return '24% 구간'
  if (income <= 150_000_000)  return '35% 구간'
  if (income <= 300_000_000)  return '38% 구간'
  if (income <= 500_000_000)  return '40% 구간'
  if (income <= 1_000_000_000) return '42% 구간'
  return '45% 구간'
}

export default function TaxSummary({ result, taxEnabled, otherFinancialIncomeKRW = 0 }: Props) {
  const t = result.tax
  if (!taxEnabled) return null

  const excessAmount = t.exceedsThreshold
    ? t.financialIncomeKRW - 20_000_000
    : 0
  const bracketLabel = getTaxBracketLabel(excessAmount)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">세금 상세 분석</h3>
        <span className="text-xs text-slate-400">{result.year}년차 기준</span>
      </div>

      {/* 배당 세금 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">배당소득세</div>
        <TaxRow label="세전 연 배당금 (이 ETF)" value={fmtKRW(result.annualDivKRW)} />
        {otherFinancialIncomeKRW > 0 && (
          <TaxRow label="다른 금융소득 (이자 등)" value={fmtKRW(otherFinancialIncomeKRW)} />
        )}
        <TaxRow
          label={`전체 금융소득${otherFinancialIncomeKRW > 0 ? ' (합산)' : ''}`}
          value={fmtKRW(t.financialIncomeKRW)}
        />
        <TaxRow label="미국 원천징수 15%" value={`-${fmtKRW(t.withholdingTaxKRW)}`} negative />
        {t.surchargeKRW > 0 && (
          <TaxRow
            label={`종소세 추가 납부 (${bracketLabel} 누진세)`}
            value={`-${fmtKRW(t.surchargeKRW)}`}
            negative
          />
        )}
        <div className="border-t border-slate-100 pt-2">
          <TaxRow label="세후 연 배당금" value={fmtKRW(t.afterTaxDivKRW)} highlight />
          <TaxRow label="세후 월 배당금" value={fmtKRW(t.afterTaxMonthlyDivKRW)} highlight />
        </div>
      </div>

      {/* 종합과세 초과 경고 */}
      {t.exceedsThreshold ? (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div>
              <div className="text-sm font-semibold text-orange-700">금융소득 종합과세 대상</div>
              <div className="text-xs text-orange-600 mt-0.5">
                전체 금융소득 {fmtKRW(t.financialIncomeKRW)} → 2,000만원 초과<br />
                초과분 {fmtKRW(excessAmount)}에{' '}
                <strong>누진세 자동 적용</strong> ({bracketLabel})<br />
                추가 납부 {fmtKRW(t.surchargeKRW)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <span className="text-lg">✅</span>
            <div>
              <div className="text-sm font-semibold text-green-700">분리과세 적용 중</div>
              <div className="text-xs text-green-600 mt-0.5">
                전체 금융소득 {fmtKRW(t.financialIncomeKRW)} — 2,000만원 이하<br />
                원천징수 15.4%로 종결, 종소세 추가 납부 없음
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
                금융소득 연 2,000만원 초과 시 피부양자 자격 상실<br />
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
      <div className="bg-slate-50 rounded-xl p-3 space-y-1">
        <div className="text-xs font-semibold text-slate-500 mb-2">연간 세금 총합</div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">배당세 + 종소세</span>
          <span className="text-sm font-bold text-red-600">-{fmtKRW(t.totalDivTaxKRW)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400">실효세율 (자동 누진 계산)</span>
          <span className="text-xs font-semibold text-slate-600">
            {t.effectiveTaxRate.toFixed(1)}%
          </span>
        </div>
        {t.exceedsThreshold && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">적용 누진세 구간</span>
            <span className="text-xs font-semibold text-orange-600">{bracketLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TaxRow({
  label, value, negative, highlight,
}: {
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
