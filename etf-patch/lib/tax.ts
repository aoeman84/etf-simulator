import { TaxSettings, TaxBreakdown } from '@/types'

// 종합소득세 누진세율표 (2024 기준)
// 산식: 과세표준 × 세율 - 누진공제
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
 * @returns 세액 (원) — 음수 방지 처리 포함
 */
function calcIncomeTax(income: number): number {
  if (income <= 0) return 0
  for (const b of INCOME_TAX_BRACKETS) {
    if (income <= b.limit) {
      const tax = income * b.rate - b.deduction
      return Math.max(0, tax) * 1.1 // 지방소득세 10% 가산
    }
  }
  return 0
}

/**
 * 금융소득 종합과세 추가 납부세액 계산
 *
 * 한국 금융소득 종합과세 로직:
 * ① 금융소득 2,000만원 이하 → 분리과세 15.4% (원천징수로 종결)
 * ② 금융소득 2,000만원 초과 → 초과 금융소득 + 다른종합소득을 합산해 누진세 적용
 *    단, 2,000만원까지는 14%로 분리과세한 것으로 간주(원천징수 15% > 14%이므로 환급 없음)
 *
 * 추가 납부액 = MAX(
 *   종소세(전체합산소득) - 종소세(다른소득만) - 분리과세세액(2,000만원 × 14%),
 *   0
 * )
 * 이미 납부한 원천징수 15%를 외국납부세액공제로 차감
 *
 * @param excessFinancialIncome  2,000만원 초과분 금융소득 (원)
 * @param otherIncome            기타 종합소득 (근로·사업 등) (원)
 * @param alreadyWithheld        이미 납부된 원천징수액 (원)
 */
function calcComprehensiveSurcharge(
  excessFinancialIncome: number,
  otherIncome: number,
  alreadyWithheld: number
): number {
  if (excessFinancialIncome <= 0) return 0

  // 합산 과세표준: 다른 소득 + 2,000만원 초과 금융소득
  const combinedIncome = otherIncome + excessFinancialIncome

  // 종소세(합산) - 종소세(다른소득만) = 초과 금융소득에 대한 실제 세부담
  const taxOnCombined = calcIncomeTax(combinedIncome)
  const taxOnOtherOnly = calcIncomeTax(otherIncome)
  const marginalTaxOnExcess = taxOnCombined - taxOnOtherOnly

  // 분리과세 기준: 2,000만원 × 14% × 1.1(지방소득세) = 이미 원천징수 15%로 커버됨
  // 추가납부 = 누진세 부담 - 이미 낸 원천징수
  const surcharge = Math.max(0, marginalTaxOnExcess - alreadyWithheld)

  return Math.round(surcharge)
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

  // ── 1. 배당소득세 (미국 원천징수) ─────────────────────────
  // 미국 원천징수 15% — 한국 분리과세 14%보다 높아 국내 추가 없음 (분리과세 시)
  const withholdingTaxKRW = tax.withholdingTax
    ? Math.round(annualDivKRW * 0.15)
    : 0

  // ── 2. 금융소득 종합과세 판단 ─────────────────────────────
  // 금융소득 = 배당금 (다른 금융소득은 otherIncomeKRW 에 포함된 것으로 간주)
  const financialIncomeKRW = annualDivKRW
  const THRESHOLD = 20_000_000 // 2,000만원
  const exceedsThreshold = financialIncomeKRW > THRESHOLD

  let surchargeKRW = 0
  let effectiveTaxRate = tax.withholdingTax ? 15 : 0 // 기본 원천징수율

  if (tax.comprehensiveIncomeTax && exceedsThreshold) {
    // 2,000만원 초과분 금융소득
    const excessFinancialIncome = financialIncomeKRW - THRESHOLD

    // 2,000만원 초과분에 대해 이미 납부된 원천징수 (15%)
    const withheldOnExcess = tax.withholdingTax
      ? excessFinancialIncome * 0.15
      : 0

    // 다른 종합소득 (근로소득, 사업소득 등)
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

  // 실효세율 계산
  if (annualDivKRW > 0) {
    effectiveTaxRate = (totalDivTaxKRW / annualDivKRW) * 100
  }

  // ── 3. 건강보험 피부양자 탈락 위험 ────────────────────────
  // 금융소득 2,000만원 초과 시 피부양자 자격 상실 위험
  const healthInsuranceRisk = !!(tax.healthInsurance && exceedsThreshold)

  // ── 4. 양도소득세 ──────────────────────────────────────────
  // 해외주식 양도세: (차익 - 250만원 공제) × 22% (지방소득세 포함)
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
  otherIncomeKRW: 0,
  healthInsurance: true,
  capitalGainsTax: true,
}
