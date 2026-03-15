import { TaxSettings, TaxBreakdown } from '@/types'

// 종합소득세 누진세율표 (2024 기준)
const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000,    rate: 0.06, deduction: 0 },
  { limit: 50_000_000,    rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000,    rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000,   rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000,   rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000,   rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity,      rate: 0.45, deduction: 65_940_000 },
]

/**
 * 종합소득세 계산 (지방소득세 10% 포함)
 * @param income 과세표준 (원)
 */
function calcIncomeTax(income: number): number {
  if (income <= 0) return 0
  for (const b of INCOME_TAX_BRACKETS) {
    if (income <= b.limit) {
      return Math.max(0, income * b.rate - b.deduction) * 1.1
    }
  }
  return 0
}

/**
 * 금융소득 종합과세 추가 납부세액 계산
 *
 * [한국 금융소득 종합과세 구조]
 * ① 금융소득 합계 2,000만원 이하 → 분리과세 15.4% (원천징수 종결)
 * ② 금융소득 합계 2,000만원 초과 →
 *    - 2,000만원까지: 분리과세 14% (원천징수 15%로 이미 커버)
 *    - 초과분: 다른 종합소득(근로·사업)과 합산 → 누진세 자동 적용
 *
 * 추가납부 = 종소세(다른소득 + 초과금융소득) - 종소세(다른소득만) - 이미 납부한 원천징수
 *
 * @param excessFinancialIncome  2,000만원 초과분 금융소득
 * @param otherIncome            근로·사업 등 다른 종합소득
 * @param alreadyWithheld        초과분에 대해 이미 납부된 원천징수액
 */
function calcComprehensiveSurcharge(
  excessFinancialIncome: number,
  otherIncome: number,
  alreadyWithheld: number
): number {
  if (excessFinancialIncome <= 0) return 0

  const combinedIncome = otherIncome + excessFinancialIncome
  const taxOnCombined = calcIncomeTax(combinedIncome)
  const taxOnOtherOnly = calcIncomeTax(otherIncome)
  const marginalTaxOnExcess = taxOnCombined - taxOnOtherOnly

  return Math.round(Math.max(0, marginalTaxOnExcess - alreadyWithheld))
}

/**
 * 연간 세금 계산
 * @param annualDivKRW   세전 연 배당금 (원)
 * @param gainKRW        누적 평가차익 (원) — 양도세 계산용
 * @param tax            세금 설정
 */
export function calcTax(
  annualDivKRW: number,
  gainKRW: number,
  tax: TaxSettings
): TaxBreakdown {
  if (!tax.enabled) {
    return {
      withholdingTaxKRW: 0,
      surchargeKRW: 0,
      totalDivTaxKRW: 0,
      afterTaxDivKRW: annualDivKRW,
      afterTaxMonthlyDivKRW: annualDivKRW / 12,
      capitalGainsTaxKRW: 0,
      afterTaxGainKRW: gainKRW,
      healthInsuranceRisk: false,
      financialIncomeKRW: annualDivKRW,
      exceedsThreshold: false,
      effectiveTaxRate: 0,
    }
  }

  // ── 1. 미국 원천징수 15% ───────────────────────────────────
  const withholdingTaxKRW = tax.withholdingTax
    ? Math.round(annualDivKRW * 0.15)
    : 0

  // ── 2. 금융소득 종합과세 판단 ─────────────────────────────
  // 전체 금융소득 = 이 ETF 배당금 + 다른 금융소득(이자·기타 배당)
  const otherFinancialIncome = tax.otherFinancialIncomeKRW ?? 0
  const financialIncomeKRW = annualDivKRW + otherFinancialIncome

  const THRESHOLD = 20_000_000 // 2,000만원
  const exceedsThreshold = financialIncomeKRW > THRESHOLD

  let surchargeKRW = 0

  if (tax.comprehensiveIncomeTax && exceedsThreshold) {
    // 2,000만원 초과분
    const excessFinancialIncome = financialIncomeKRW - THRESHOLD

    // 초과분 중 이 ETF 배당에서 발생한 비율만큼 원천징수 배분
    const excessRatio = excessFinancialIncome / financialIncomeKRW
    const withheldOnExcess = tax.withholdingTax
      ? Math.round(annualDivKRW * excessRatio * 0.15)
      : 0

    // 다른 종합소득(근로·사업소득)
    const otherIncome = tax.otherIncomeKRW ?? 0

    surchargeKRW = calcComprehensiveSurcharge(
      excessFinancialIncome,
      otherIncome,
      withheldOnExcess
    )
  }

  const totalDivTaxKRW = withholdingTaxKRW + surchargeKRW
  const afterTaxDivKRW = annualDivKRW - totalDivTaxKRW
  const afterTaxMonthlyDivKRW = afterTaxDivKRW / 12
  const effectiveTaxRate = annualDivKRW > 0
    ? (totalDivTaxKRW / annualDivKRW) * 100
    : 0

  // ── 3. 건강보험 피부양자 탈락 위험 ───────────────────────
  const healthInsuranceRisk = !!(tax.healthInsurance && exceedsThreshold)

  // ── 4. 양도소득세 ─────────────────────────────────────────
  const CAPITAL_DEDUCTION = 2_500_000
  let capitalGainsTaxKRW = 0
  if (tax.capitalGainsTax && gainKRW > CAPITAL_DEDUCTION) {
    capitalGainsTaxKRW = Math.round((gainKRW - CAPITAL_DEDUCTION) * 0.22)
  }
  const afterTaxGainKRW = gainKRW - capitalGainsTaxKRW

  return {
    withholdingTaxKRW,
    surchargeKRW,
    totalDivTaxKRW,
    afterTaxDivKRW,
    afterTaxMonthlyDivKRW,
    capitalGainsTaxKRW,
    afterTaxGainKRW,
    healthInsuranceRisk,
    financialIncomeKRW,
    exceedsThreshold,
    effectiveTaxRate,
  }
}

export const DEFAULT_TAX: TaxSettings = {
  enabled: true,
  withholdingTax: true,
  comprehensiveIncomeTax: true,
  otherFinancialIncomeKRW: 0,
  otherIncomeKRW: 0,
  healthInsurance: true,
  capitalGainsTax: true,
}
