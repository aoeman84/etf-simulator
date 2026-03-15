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

function weightedReturnRate(allocs: EtfAlloc[], scenario?: SimKParams['scenario']): number {
  let r = 0
  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue
    let priceCAGR = etf.priceCAGR
    if (scenario) {
      if (scenario.mode === 'pessimistic') priceCAGR *= 0.5
      else priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
    }
    r += (priceCAGR + etf.divYield) / 100 * (pct / 100)
  }
  return r
}

function weightedNormalReturnRate(allocs: EtfAlloc[], scenario?: SimKParams['scenario']): number {
  let r = 0
  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue
    let priceCAGR = etf.priceCAGR
    if (scenario) {
      if (scenario.mode === 'pessimistic') priceCAGR *= 0.5
      else priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
    }
    r += (priceCAGR + etf.divYield * (1 - 0.154)) / 100 * (pct / 100)
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
  const { mode, isa, pension, irp, taxCreditRate, currentAge, retirementAge, reinvestRefund, scenario } = params

  const years = Math.max(1, retirementAge - currentAge)

  const annualISA     = getAnnualWan(isa, mode, 2000)
  const annualPension = getAnnualWan(pension, mode, 1500)
  const annualIRP     = getAnnualWan(irp, mode, 300)

  const rISA     = weightedReturnRate(isa.etfAlloc, scenario)
  const rPension = weightedReturnRate(pension.etfAlloc, scenario)
  const rIRP     = weightedReturnRate(irp.etfAlloc, scenario)

  const nISA     = weightedNormalReturnRate(isa.etfAlloc, scenario)
  const nPension = weightedNormalReturnRate(pension.etfAlloc, scenario)
  const nIRP     = weightedNormalReturnRate(irp.etfAlloc, scenario)
  const totalAnnual = annualISA + annualPension + annualIRP
  const normalReturn = totalAnnual > 0
    ? (nISA * annualISA + nPension * annualPension + nIRP * annualIRP) / totalAnnual
    : nISA

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
    const age = currentAge + y
    const isMatureYear = y % 3 === 0

    const isaContrib     = annualISA * 10000
    const pensionExtra   = reinvestRefund ? extraPensionNextYear : 0
    const pensionContrib = annualPension * 10000 + pensionExtra
    const irpContrib     = annualIRP * 10000

    // ISA 납입: 만기 해지 연도에는 루프 상단에서 건너뜀 (만기 처리 후 새 ISA에 납입)
    if (!isMatureYear) {
      isaBalance   += isaContrib
      isaCostBasis += isaContrib
    }
    pensionBalance   += pensionContrib
    irpBalance       += irpContrib
    totalContributed += isaContrib + annualPension * 10000 + irpContrib

    isaBalance     *= (1 + rISA)
    pensionBalance *= (1 + rPension)
    irpBalance     *= (1 + rIRP)

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

      pensionBalance      += isaAfterTax
      cumulativeTaxCredit += isaTransferCredit

      isaBalance   = 0
      isaCostBasis = 0

      // 만기 즉시 새 ISA 개설 + 해당 연도 납입
      isaBalance   += isaContrib
      isaCostBasis += isaContrib
    }

    const pensionCredited = Math.min(annualPension * 10000, 6_000_000)
    const irpCredited     = Math.min(irpContrib, Math.max(0, 9_000_000 - pensionCredited))
    const yearlyTaxCredit = (pensionCredited + irpCredited) * taxCreditRate + isaTransferCredit

    cumulativeTaxCredit += (pensionCredited + irpCredited) * taxCreditRate
    extraPensionNextYear = (pensionCredited + irpCredited) * taxCreditRate

    normalBalance += totalAnnual * 10000
    normalBalance *= (1 + normalReturn)

    const totalBalance = isaBalance + pensionBalance + irpBalance

    rows.push({
      year: y, age,
      isaBalance, pensionBalance, irpBalance, totalBalance,
      isaContributed: isaContrib, pensionContributed: pensionContrib, irpContributed: irpContrib,
      taxCreditThisYear: yearlyTaxCredit, cumulativeTaxCredit,
      isaTransfer, isaTransferCredit, normalBalance,
    })
  }

  const lastRow = rows[rows.length - 1]
  const finalBalance = lastRow?.totalBalance ?? 0
  const normalFinalBalance = lastRow?.normalBalance ?? 0

  const normalGain = normalFinalBalance - totalContributed
  const normalCapGainsTax = normalGain > 2_500_000 ? (normalGain - 2_500_000) * 0.22 : 0
  const normalAfterTax = normalFinalBalance - normalCapGainsTax

  const pTaxRate = pensionTaxRate(retirementAge)
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
