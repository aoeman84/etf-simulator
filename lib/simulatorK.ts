import { ETF_DATA } from './simulator'

export interface SimKParams {
  mode: 'monthly' | 'annual'
  // monthly mode (만원)
  totalMonthlyWan: number
  // annual mode (만원)
  isaAnnualWan: number
  pensionAnnualWan: number
  irpAnnualWan: number
  // common
  ticker: string
  taxCreditRate: number   // 0.132 or 0.165
  currentAge: number
  retirementAge: number
  reinvestRefund: boolean
  scenario?: { priceCAGRAdj: number; divGrowthAdj: number; mode: string }
}

export interface SimKYearRow {
  year: number
  age: number
  isaBalance: number
  pensionBalance: number
  irpBalance: number
  totalBalance: number
  isaContributed: number
  pensionContributed: number
  irpContributed: number
  taxCreditThisYear: number
  cumulativeTaxCredit: number
  isaTransfer: number         // ISA 만기 이체금액 (해당 연도만)
  isaTransferCredit: number   // ISA 이체 추가 세액공제
  normalBalance: number       // 일반 계좌 비교
}

export interface SimKResult {
  rows: SimKYearRow[]
  totalContributed: number
  finalBalance: number           // 수령 나이 기준 총 절세 계좌 잔액
  normalFinalBalance: number     // 동기간 일반 계좌 잔액
  totalTaxCredit: number         // 누적 세액공제 환급 합계
  taxAdvantage: number           // 절세 계좌 - 일반 계좌
  monthlyPension: number         // 연금소득세 후 예상 월 연금
  pensionTaxRate: number         // 적용된 연금소득세율
}

// 연금소득세율 (지방소득세 포함)
function pensionTaxRate(age: number): number {
  if (age >= 80) return 0.033
  if (age >= 70) return 0.044
  return 0.055
}

// 시나리오 적용 총수익률 계산
function totalReturnRate(ticker: string, scenario?: SimKParams['scenario']): number {
  const etf = ETF_DATA[ticker]
  if (!etf) return 0.1
  let priceCAGR = etf.priceCAGR
  if (scenario) {
    if (scenario.mode === 'pessimistic') priceCAGR = priceCAGR * 0.5
    else priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
  }
  return (priceCAGR + etf.divYield) / 100
}

export function simulateK(params: SimKParams): SimKResult {
  const {
    mode, totalMonthlyWan, isaAnnualWan, pensionAnnualWan, irpAnnualWan,
    ticker, taxCreditRate, currentAge, retirementAge, reinvestRefund, scenario,
  } = params

  const years = Math.max(1, retirementAge - currentAge)
  const r = totalReturnRate(ticker, scenario)

  // 연간 납입액 계산 (만원 단위)
  let annualISA: number, annualPension: number, annualIRP: number
  if (mode === 'monthly') {
    annualISA     = Math.min(totalMonthlyWan * 12 * 0.68, 2000)
    annualPension = Math.min(totalMonthlyWan * 12 * 0.20, 1500)
    annualIRP     = Math.min(totalMonthlyWan * 12 * 0.12, 300)
  } else {
    annualISA     = Math.min(isaAnnualWan, 2000)
    annualPension = Math.min(pensionAnnualWan, 1500)
    annualIRP     = Math.min(irpAnnualWan, 300)
  }

  // 일반 계좌 비교용 수익률 (배당 15.4% 원천징수 고려)
  const etf = ETF_DATA[ticker] ?? ETF_DATA['SCHD']
  let normalPriceCAGR = etf.priceCAGR
  if (scenario) {
    if (scenario.mode === 'pessimistic') normalPriceCAGR = normalPriceCAGR * 0.5
    else normalPriceCAGR = Math.max(0, normalPriceCAGR + scenario.priceCAGRAdj)
  }
  const normalReturn = (normalPriceCAGR + etf.divYield * (1 - 0.154)) / 100
  const totalAnnualNormal = annualISA + annualPension + annualIRP  // 만원

  const rows: SimKYearRow[] = []
  let isaBalance = 0
  let pensionBalance = 0
  let irpBalance = 0
  let isaCostBasis = 0      // 현재 ISA 사이클의 납입 원금
  let cumulativeTaxCredit = 0
  let totalContributed = 0
  let normalBalance = 0
  let extraPensionNextYear = 0  // 세액공제 환급금 재투자

  for (let y = 1; y <= years; y++) {
    const age = currentAge + y

    // ── 납입 ──────────────────────────────────────────────
    const isaContrib   = annualISA * 10000
    const pensionExtra = reinvestRefund ? extraPensionNextYear : 0
    const pensionContrib = annualPension * 10000 + pensionExtra
    const irpContrib   = annualIRP * 10000

    isaBalance     += isaContrib
    pensionBalance += pensionContrib
    irpBalance     += irpContrib
    isaCostBasis   += isaContrib
    totalContributed += isaContrib + annualPension * 10000 + irpContrib

    // ── 성장 (과세 이연) ──────────────────────────────────
    isaBalance     *= (1 + r)
    pensionBalance *= (1 + r)
    irpBalance     *= (1 + r)

    // ── ISA 3년 만기 해지 ─────────────────────────────────
    let isaTransfer = 0
    let isaTransferCredit = 0
    if (y % 3 === 0) {
      const isaGain     = Math.max(0, isaBalance - isaCostBasis)
      const taxFreeGain = Math.min(isaGain, 2_000_000)     // 200만원 비과세
      const taxableGain = Math.max(0, isaGain - taxFreeGain)
      const isaTax      = taxableGain * 0.099              // 9.9% 분리과세
      const isaAfterTax = isaBalance - isaTax

      isaTransfer        = isaAfterTax
      isaTransferCredit  = Math.min(isaAfterTax * 0.1, 3_000_000)  // max 300만원

      pensionBalance    += isaAfterTax
      cumulativeTaxCredit += isaTransferCredit

      isaBalance   = 0
      isaCostBasis = 0
    }

    // ── 세액공제 계산 ─────────────────────────────────────
    const pensionCredited = Math.min(annualPension * 10000, 6_000_000)   // max 600만원
    const irpCredited     = Math.min(irpContrib, Math.max(0, 9_000_000 - pensionCredited))
    const yearlyTaxCredit = (pensionCredited + irpCredited) * taxCreditRate + isaTransferCredit

    cumulativeTaxCredit += (pensionCredited + irpCredited) * taxCreditRate
    extraPensionNextYear = (pensionCredited + irpCredited) * taxCreditRate

    // ── 일반 계좌 ─────────────────────────────────────────
    normalBalance += totalAnnualNormal * 10000
    normalBalance *= (1 + normalReturn)

    const totalBalance = isaBalance + pensionBalance + irpBalance

    rows.push({
      year: y,
      age,
      isaBalance,
      pensionBalance,
      irpBalance,
      totalBalance,
      isaContributed:   isaContrib,
      pensionContributed: pensionContrib,
      irpContributed:   irpContrib,
      taxCreditThisYear: yearlyTaxCredit,
      cumulativeTaxCredit,
      isaTransfer,
      isaTransferCredit,
      normalBalance,
    })
  }

  const lastRow = rows[rows.length - 1]
  const finalBalance = lastRow?.totalBalance ?? 0
  const normalFinalBalance = lastRow?.normalBalance ?? 0

  // 일반 계좌 양도소득세 (매도 시): gains > 250만원에 22%
  const normalGain = normalFinalBalance - totalContributed
  const normalCapGainsTax = normalGain > 2_500_000
    ? (normalGain - 2_500_000) * 0.22 : 0
  const normalAfterTax = normalFinalBalance - normalCapGainsTax

  // 연금소득세 후 월 연금 (20년 분할 수령 가정)
  const pTaxRate = pensionTaxRate(retirementAge)
  const annualPensionIncome = finalBalance / 20
  const monthlyPension = (annualPensionIncome * (1 - pTaxRate)) / 12

  // 1200만원 초과 여부는 UI에서 표시

  return {
    rows,
    totalContributed,
    finalBalance,
    normalFinalBalance: normalAfterTax,
    totalTaxCredit: lastRow?.cumulativeTaxCredit ?? 0,
    taxAdvantage: finalBalance - normalAfterTax,
    monthlyPension,
    pensionTaxRate: pTaxRate,
  }
}
