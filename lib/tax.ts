import { TaxSettings, TaxBreakdown } from '@/types'

// 종합소득세 누진세율표 (2024 기준)
const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000,   rate: 0.06, deduction: 0 },
  { limit: 50_000_000,   rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000,   rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000,  rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000,  rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000,  rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000,rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity,     rate: 0.45, deduction: 65_940_000 },
]

// 지방소득세 포함 실효세율 계산 (종소세 × 1.1)
function incomeTax(income: number): number {
  for (const b of INCOME_TAX_BRACKETS) {
    if (income <= b.limit) {
      return income * b.rate - b.deduction
    }
  }
  return 0
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
    }
  }

  // ── 1. 배당소득세 ──────────────────────────────────────────
  // 미국 원천징수 15% (한국 배당세 14% 보다 높아 국내 추가 납부 없음)
  const withholdingTaxKRW = tax.withholdingTax
    ? annualDivKRW * 0.15
    : 0

  // 세후 배당금 (원천징수 후)
  const divAfterWithholding = annualDivKRW - withholdingTaxKRW

  // ── 2. 금융소득 종합과세 ───────────────────────────────────
  // 연 금융소득 = 배당금(세전) + 기타 금융소득
  const financialIncomeKRW = annualDivKRW + (tax.otherIncomeKRW ?? 0)
  const THRESHOLD = 20_000_000 // 2,000만원
  const exceedsThreshold = financialIncomeKRW > THRESHOLD

  let surchargeKRW = 0
  if (tax.comprehensiveIncomeTax && exceedsThreshold) {
    // 2000만원까지는 분리과세 14% (이미 원천징수로 15% 납부 → 초과분 없음)
    // 2000만원 초과분을 다른 종합소득과 합산해 누진세 적용
    const excessDiv = financialIncomeKRW - THRESHOLD

    // 종소세: 초과 금융소득에 한계세율 적용 후 지방소득세 10% 추가
    const marginalRate = (tax.marginalRate ?? 35) / 100
    const grossSurcharge = excessDiv * marginalRate * 1.1

    // 이미 원천징수한 15% 공제 (외국납부세액공제)
    const alreadyPaid = excessDiv * 0.15
    surchargeKRW = Math.max(0, grossSurcharge - alreadyPaid)
  }

  const totalDivTaxKRW = withholdingTaxKRW + surchargeKRW
  const afterTaxDivKRW = annualDivKRW - totalDivTaxKRW
  const afterTaxMonthlyDivKRW = afterTaxDivKRW / 12

  // ── 3. 건강보험 피부양자 탈락 ─────────────────────────────
  // 금융소득 연 2000만원 초과 시 피부양자 자격 상실
  const healthInsuranceRisk = tax.healthInsurance && exceedsThreshold

  // ── 4. 양도소득세 ──────────────────────────────────────────
  // 해외주식 양도세: (차익 - 250만원 공제) × 22% (지방세 포함)
  const CAPITAL_DEDUCTION = 2_500_000
  let capitalGainsTaxKRW = 0
  if (tax.capitalGainsTax && gainKRW > CAPITAL_DEDUCTION) {
    capitalGainsTaxKRW = (gainKRW - CAPITAL_DEDUCTION) * 0.22
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
  }
}

export const DEFAULT_TAX: TaxSettings = {
  enabled: true,
  withholdingTax: true,
  comprehensiveIncomeTax: true,
  otherIncomeKRW: 0,
  marginalRate: 35,
  healthInsurance: true,
  capitalGainsTax: true,
}
