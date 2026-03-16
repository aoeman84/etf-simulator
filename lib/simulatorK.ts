import { ETF_DATA } from './simulator'

export type EtfAlloc = { ticker: string; pct: number }

export interface MonthlyAccount {
  monthlyWan: number
  etfAlloc: EtfAlloc[]
}

export interface AnnualAccount {
  annualWan: number
  etfAlloc: EtfAlloc[]
}

export interface SimKParams {
  mode: 'monthly' | 'annual'
  isa: MonthlyAccount | AnnualAccount
  pension: MonthlyAccount | AnnualAccount
  irp: MonthlyAccount | AnnualAccount
  taxCreditRate: number
  startAge: number
  currentAge?: number
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
  isaTransfer: number
  isaTransferCredit: number
  normalBalance: number
}

export interface SimKResult {
  rows: SimKYearRow[]
  totalContributed: number
  finalBalance: number
  normalFinalBalance: number
  totalTaxCredit: number
  taxAdvantage: number
  monthlyPension: number
  pensionTaxRate: number
}

function pensionTaxRate(age: number): number {
  if (age >= 80) return 0.033
  if (age >= 70) return 0.044
  return 0.055
}

/**
 * 시나리오별 ETF yield 매핑
 * - 낙관: 주가 많이 오르면 yield 압축 (배당/주가 = 낮아짐)
 * - 중립: 14년 역사 평균 기준
 * - 비관: 주가 정체/하락 시 yield 확대
 *
 * SCHD 실제 yield 역사 (2012~2025):
 *   평균 1.89%, 최근 3년 2.87%, 현재 3.4%
 *   낙관(강세장) 1.3~1.5% / 중립 2.5% / 비관(약세장) 3.5%
 *
 * VOO 역사 평균: 1.67%
 * QQQ 역사 평균: 0.62%
 */
export const SCENARIO_YIELD: Record<string, Record<string, number>> = {
  optimistic: { SCHD: 0.015, VOO: 0.010, QQQ: 0.004, VYM: 0.025, JEPI: 0.060 },
  neutral:    { SCHD: 0.025, VOO: 0.015, QQQ: 0.006, VYM: 0.035, JEPI: 0.075 },
  pessimistic:{ SCHD: 0.035, VOO: 0.020, QQQ: 0.009, VYM: 0.045, JEPI: 0.090 },
}

export function getScenarioMode(scenario?: SimKParams['scenario']): 'optimistic' | 'neutral' | 'pessimistic' {
  if (!scenario) return 'optimistic'
  if (scenario.mode === 'pessimistic') return 'pessimistic'
  if (scenario.mode === 'neutral' || scenario.priceCAGRAdj < 0) return 'neutral'
  return 'optimistic'
}

/**
 * 절세 계좌 수익률 계산
 * - priceCAGR: 주가 상승분 (시나리오 반영)
 * - divYield: 시나리오별 고정 yield (배당성장률 제거, 현실적 yield 사용)
 * - divYield * 0.5: 분기배당 타이밍 손실 반영
 */
function weightedReturnRate(
  allocs: EtfAlloc[],
  scenarioMode: 'optimistic' | 'neutral' | 'pessimistic',
  scenario?: SimKParams['scenario']
): number {
  let r = 0
  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue

    let priceCAGR = etf.priceCAGR
    if (scenario) {
      if (scenario.mode === 'pessimistic') {
        priceCAGR *= 0.5
      } else {
        priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
      }
    }

    // 시나리오별 고정 yield 사용 (배당성장률 제거)
    const divYield = SCENARIO_YIELD[scenarioMode][ticker] ?? etf.divYield / 100

    // divYield * 0.5: 분기배당 타이밍 손실 반영
    r += (priceCAGR / 100 + divYield * 0.5) * (pct / 100)
  }
  return r
}

/**
 * 일반 계좌 수익률 (배당세 15.4% 차감)
 */
function weightedNormalReturnRate(
  allocs: EtfAlloc[],
  scenarioMode: 'optimistic' | 'neutral' | 'pessimistic',
  scenario?: SimKParams['scenario']
): number {
  let r = 0
  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue

    let priceCAGR = etf.priceCAGR
    if (scenario) {
      if (scenario.mode === 'pessimistic') {
        priceCAGR *= 0.5
      } else {
        priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
      }
    }

    const divYield = SCENARIO_YIELD[scenarioMode][ticker] ?? etf.divYield / 100
    r += (priceCAGR / 100 + divYield * 0.5 * (1 - 0.154)) * (pct / 100)
  }
  return r
}

function getAnnualWan(acct: MonthlyAccount | AnnualAccount, mode: 'monthly' | 'annual', cap: number): number {
  if (mode === 'monthly') {
    return Math.min((acct as MonthlyAccount).monthlyWan * 12, cap)
  }
  return Math.min((acct as AnnualAccount).annualWan, cap)
}

export function simulateK(params: SimKParams): SimKResult {
  const { mode, isa, pension, irp, taxCreditRate, startAge, retirementAge, reinvestRefund, scenario } = params

  const years = Math.max(1, retirementAge - startAge)
  const annualISA     = getAnnualWan(isa,     mode, 2000)
  const annualPension = getAnnualWan(pension, mode, 1500)
  const annualIRP     = getAnnualWan(irp,     mode, 300)

  const scenarioMode = getScenarioMode(scenario)

  const rISA     = weightedReturnRate(isa.etfAlloc,     scenarioMode, scenario)
  const rPension = weightedReturnRate(pension.etfAlloc, scenarioMode, scenario)
  const rIRP     = weightedReturnRate(irp.etfAlloc,     scenarioMode, scenario)

  // 일반 계좌 수익률: 세 계좌 납입액 비중 가중평균
  const totalContribBase = annualISA + annualPension + annualIRP
  const nReturn = totalContribBase > 0
    ? (weightedNormalReturnRate(isa.etfAlloc,     scenarioMode, scenario) * annualISA +
       weightedNormalReturnRate(pension.etfAlloc, scenarioMode, scenario) * annualPension +
       weightedNormalReturnRate(irp.etfAlloc,     scenarioMode, scenario) * annualIRP) / totalContribBase
    : weightedNormalReturnRate(isa.etfAlloc, scenarioMode, scenario)

  const rows: SimKYearRow[] = []
  let isaBalance = 0
  let pensionBalance = 0
  let irpBalance = 0
  let isaCostBasis = 0
  let cumulativeTaxCredit = 0
  let totalContributed = 0
  let normalBalance = 0
  let extraPensionNextYear = 0

  for (let y = 1; y <= years; y++) {
    const age = startAge + y
    const isMatureYear = y % 3 === 0

    const isaContrib     = annualISA * 10000
    const pensionExtra   = reinvestRefund ? extraPensionNextYear : 0
    const pensionContrib = annualPension * 10000 + pensionExtra
    const irpContrib     = annualIRP * 10000

    // ISA 연초 납입 (만기 해지 연도는 만기 처리 후 별도 납입)
    if (!isMatureYear) {
      isaBalance   += isaContrib
      isaCostBasis += isaContrib
    }
    totalContributed += isaContrib + annualPension * 10000 + irpContrib

    // 수익 적용 (연초 납입 → 1년 전체 복리)
    isaBalance     *= (1 + rISA)
    pensionBalance *= (1 + rPension)
    irpBalance     *= (1 + rIRP)

    // 연금저축·IRP 납입은 연말 처리
    pensionBalance += pensionContrib
    irpBalance     += irpContrib

    let isaTransfer = 0
    let isaTransferCredit = 0

    if (isMatureYear) {
      const isaGain     = Math.max(0, isaBalance - isaCostBasis)
      const taxFreeGain = Math.min(isaGain, 2_000_000)
      const taxableGain = Math.max(0, isaGain - taxFreeGain)
      const isaTax      = taxableGain * 0.099
      const isaAfterTax = isaBalance - isaTax

      isaTransfer       = isaAfterTax
      isaTransferCredit = Math.min(isaAfterTax * 0.1, 3_000_000)

      pensionBalance    += isaAfterTax
      cumulativeTaxCredit += isaTransferCredit

      isaBalance   = 0
      isaCostBasis = 0

      // 4번째 납입: 만기 당해 연초 새 ISA 납입 → 1년 수익 적용
      isaBalance   += isaContrib * (1 + rISA)
      isaCostBasis += isaContrib
      totalContributed += isaContrib
    }

    const pensionCredited = Math.min(annualPension * 10000, 6_000_000)
    const irpCredited     = Math.min(irpContrib, Math.max(0, 9_000_000 - pensionCredited))
    const yearlyTaxCredit = (pensionCredited + irpCredited) * taxCreditRate + isaTransferCredit

    cumulativeTaxCredit  += (pensionCredited + irpCredited) * taxCreditRate
    extraPensionNextYear  = (pensionCredited + irpCredited) * taxCreditRate

    normalBalance += (annualISA + annualPension + annualIRP) * 10000
    normalBalance *= (1 + nReturn)

    const totalBalance = isaBalance + pensionBalance + irpBalance

    rows.push({
      year: y, age,
      isaBalance, pensionBalance, irpBalance, totalBalance,
      isaContributed:     isaContrib,
      pensionContributed: pensionContrib,
      irpContributed:     irpContrib,
      taxCreditThisYear:  yearlyTaxCredit,
      cumulativeTaxCredit,
      isaTransfer, isaTransferCredit,
      normalBalance,
    })
  }

  const lastRow = rows[rows.length - 1]
  const finalBalance       = lastRow?.totalBalance ?? 0
  const normalFinalBalance = lastRow?.normalBalance ?? 0
  const normalGain         = normalFinalBalance - totalContributed
  const normalCapGainsTax  = normalGain > 2_500_000 ? (normalGain - 2_500_000) * 0.22 : 0
  const normalAfterTax     = normalFinalBalance - normalCapGainsTax

  const pTaxRate       = pensionTaxRate(retirementAge)
  const monthlyPension = (finalBalance / 20 * (1 - pTaxRate)) / 12

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
