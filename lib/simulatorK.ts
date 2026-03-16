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
  currentAge: number  // 현재 나이 (테이블 강조 표시용)
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
 * 절세 계좌 수익률 계산
 * - priceCAGR: 주가 상승분 (시나리오 반영)
 * - divYield * 0.5: 분기배당 타이밍 손실 반영 (평균 반기만 재투자)
 * - divGrowth: 배당성장률 (Sim 탭과 동일하게 연도별 적용)
 */
function weightedReturnRate(
  allocs: EtfAlloc[],
  year: number,
  scenario?: SimKParams['scenario']
): number {
  let r = 0
  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue

    let priceCAGR = etf.priceCAGR
    let divGrowth = etf.divGrowthCAGR / 100

    if (scenario) {
      if (scenario.mode === 'pessimistic') {
        priceCAGR *= 0.5
        divGrowth = 0
      } else {
        priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
        divGrowth = Math.max(0, divGrowth + scenario.divGrowthAdj / 100)
      }
    }

    // 배당성장률 반영: y년차 배당수익률
    const currentDivYield = etf.divYield / 100 * Math.pow(1 + divGrowth, year - 1)

    // divYield * 0.5: 분기배당 타이밍 손실 반영
    r += (priceCAGR / 100 + currentDivYield * 0.5) * (pct / 100)
  }
  return r
}

/**
 * 일반 계좌 수익률 (배당세 15.4% 차감, 배당성장 반영)
 */
function weightedNormalReturnRate(
  allocs: EtfAlloc[],
  year: number,
  scenario?: SimKParams['scenario']
): number {
  let r = 0
  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue

    let priceCAGR = etf.priceCAGR
    let divGrowth = etf.divGrowthCAGR / 100

    if (scenario) {
      if (scenario.mode === 'pessimistic') {
        priceCAGR *= 0.5
        divGrowth = 0
      } else {
        priceCAGR = Math.max(0, priceCAGR + scenario.priceCAGRAdj)
        divGrowth = Math.max(0, divGrowth + scenario.divGrowthAdj / 100)
      }
    }

    const currentDivYield = etf.divYield / 100 * Math.pow(1 + divGrowth, year - 1)
    r += (priceCAGR / 100 + currentDivYield * 0.5 * (1 - 0.154)) * (pct / 100)
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
  const { mode, isa, pension, irp, taxCreditRate, startAge, currentAge: _currentAge, retirementAge, reinvestRefund, scenario } = params

  const years = Math.max(1, retirementAge - startAge)
  const annualISA     = getAnnualWan(isa,     mode, 2000)
  const annualPension = getAnnualWan(pension, mode, 1500)
  const annualIRP     = getAnnualWan(irp,     mode, 300)

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

    // 연도별 수익률 계산 (배당성장률 반영)
    const rISA     = weightedReturnRate(isa.etfAlloc,     y, scenario)
    const rPension = weightedReturnRate(pension.etfAlloc, y, scenario)
    const rIRP     = weightedReturnRate(irp.etfAlloc,     y, scenario)
    const nReturn  = weightedNormalReturnRate(
      isa.etfAlloc, y, scenario
    )

    const isaContrib    = annualISA * 10000
    const pensionExtra  = reinvestRefund ? extraPensionNextYear : 0
    const pensionContrib = annualPension * 10000 + pensionExtra
    const irpContrib    = annualIRP * 10000

    // ✅ ISA 연초 납입 (만기 해지 연도는 만기 처리 후 별도 납입)
    if (!isMatureYear) {
      isaBalance   += isaContrib
      isaCostBasis += isaContrib
    }
    totalContributed += isaContrib + annualPension * 10000 + irpContrib

    // 수익 적용 (연초 납입 → 1년 전체 복리)
    isaBalance     *= (1 + rISA)
    pensionBalance *= (1 + rPension)
    irpBalance     *= (1 + rIRP)

    // 연금저축·IRP 납입은 연말 처리 (당해연도 수익 없음)
    pensionBalance += pensionContrib
    irpBalance     += irpContrib

    let isaTransfer = 0
    let isaTransferCredit = 0

    if (isMatureYear) {
      // 만기 해지
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

      // ✅ 4번째 납입: 만기 당해 연초에 새 ISA 납입 → 1년 수익 적용
      // (ISA는 연초에 납입하므로 만기 해지와 같은 해에 이미 수익이 붙어 있음)
      isaBalance   += isaContrib * (1 + rISA)
      isaCostBasis += isaContrib
      totalContributed += isaContrib  // 4번째 납입 원금 추가
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
      isaContributed:    isaContrib,
      pensionContributed: pensionContrib,
      irpContributed:    irpContrib,
      taxCreditThisYear: yearlyTaxCredit,
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

