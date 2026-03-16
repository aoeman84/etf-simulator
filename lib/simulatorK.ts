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
  taxCreditRate: number       // 0.132 or 0.165
  startAge: number            // 투자 시작 나이
  currentAge: number          // 현재 나이 (테이블 강조용)
  retirementAge: number       // 연금 수령 나이
  reinvestRefund: boolean     // 세액공제 환급금 재투자 여부
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
  isMatureYear: boolean
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

function getPensionTaxRate(age: number): number {
  if (age >= 80) return 0.033
  if (age >= 70) return 0.044
  return 0.055
}

// 계좌별 ETF 가중평균 파라미터
interface EtfParams {
  price: number
  priceCAGR: number
  divYield: number
  divGrowthCAGR: number
}

function getWeightedEtfParams(
  allocs: EtfAlloc[],
  scenario?: SimKParams['scenario']
): EtfParams {
  let price = 0, priceCAGR = 0, divYield = 0, divGrowthCAGR = 0
  let totalPct = 0

  for (const { ticker, pct } of allocs) {
    if (pct === 0) continue
    const etf = ETF_DATA[ticker]
    if (!etf) continue

    let pc = etf.priceCAGR
    let dg = etf.divGrowthCAGR

    if (scenario) {
      if (scenario.mode === 'pessimistic') {
        pc = pc * 0.5
        dg = 0
      } else {
        pc = Math.max(0, pc + scenario.priceCAGRAdj)
        dg = Math.max(0, dg + scenario.divGrowthAdj)
      }
    }

    const w = pct / 100
    price         += etf.price * w
    priceCAGR     += pc * w
    divYield      += etf.divYield * w
    divGrowthCAGR += dg * w
    totalPct      += w
  }

  if (totalPct === 0) return { price: 1, priceCAGR: 0.085, divYield: 3.4, divGrowthCAGR: 11 }

  return {
    price:         price / totalPct,
    priceCAGR:     priceCAGR / totalPct,
    divYield:      divYield / totalPct,
    divGrowthCAGR: divGrowthCAGR / totalPct,
  }
}

const FX_RATE = 1500
const DIV_MONTHS = [3, 6, 9, 12]
// 배당 원천징수 15% (2025년 이후 현실 반영, 보수적)
const DIV_TAX_RATE = 0.15
// 일반계좌 배당세
const NORMAL_DIV_TAX_RATE = 0.154

export function simulateK(params: SimKParams): SimKResult {
  const {
    mode, isa, pension, irp,
    taxCreditRate, startAge, retirementAge,
    reinvestRefund, scenario,
  } = params

  const years = Math.max(1, retirementAge - startAge)

  // 계좌별 연간 납입금 (만원)
  const annISAWan     = mode === 'monthly'
    ? (isa     as MonthlyAccount).monthlyWan * 12
    : (isa     as AnnualAccount).annualWan
  const annPenWan     = mode === 'monthly'
    ? (pension as MonthlyAccount).monthlyWan * 12
    : (pension as AnnualAccount).annualWan
  const annIRPWan     = mode === 'monthly'
    ? (irp     as MonthlyAccount).monthlyWan * 12
    : (irp     as AnnualAccount).annualWan

  // 세액공제 계산용 한도
  const penCredited = Math.min(annPenWan * 10000, 6_000_000)
  const irpCredited = Math.min(annIRPWan * 10000, Math.max(0, 9_000_000 - penCredited))
  const yearlyCredit = (penCredited + irpCredited) * taxCreditRate

  // ETF 가중평균 파라미터
  const isaEtf  = getWeightedEtfParams(isa.etfAlloc,     scenario)
  const penEtf  = getWeightedEtfParams(pension.etfAlloc, scenario)
  const irpEtf  = getWeightedEtfParams(irp.etfAlloc,     scenario)

  // 일반계좌 비교용 (ISA와 동일 ETF)
  const normEtf = isaEtf

  // 주식 수 상태
  let isaShares    = 0, isaCostBasis  = 0
  let penShares    = 0
  let irpShares    = 0
  let normalShares = 0

  let totalContributed = 0
  let cumulativeTaxCredit = 0
  let extraPenNextYear = 0

  const rows: SimKYearRow[] = []

  for (let y = 1; y <= years; y++) {
    const age = startAge + y
    const posInCycle = ((y - 1) % 3) + 1  // 1, 2, 3
    const isMatureYear = posInCycle === 3

    // 배당성장 반영 배당 (연도별)
    const isaDiv1  = isaEtf.price  * (isaEtf.divYield  / 100) * Math.pow(1 + isaEtf.divGrowthCAGR  / 100, y - 1)
    const penDiv1  = penEtf.price  * (penEtf.divYield  / 100) * Math.pow(1 + penEtf.divGrowthCAGR  / 100, y - 1)
    const irpDiv1  = irpEtf.price  * (irpEtf.divYield  / 100) * Math.pow(1 + irpEtf.divGrowthCAGR  / 100, y - 1)
    const normDiv1 = normEtf.price * (normEtf.divYield / 100) * Math.pow(1 + normEtf.divGrowthCAGR / 100, y - 1)

    const isaDivPerPeriod  = isaDiv1  / 4
    const penDivPerPeriod  = penDiv1  / 4
    const irpDivPerPeriod  = irpDiv1  / 4
    const normDivPerPeriod = normDiv1 / 4

    let isaContribYear  = 0
    let penContribYear  = 0
    let irpContribYear  = 0

    // 세액공제 환급금 재투자 (옵션)
    const penExtra = reinvestRefund ? extraPenNextYear : 0

    for (let m = 1; m <= 12; m++) {
      // 월별 주가
      const isaPrice  = isaEtf.price  * Math.pow(1 + isaEtf.priceCAGR  / 100, (y - 1) + m / 12)
      const penPrice  = penEtf.price  * Math.pow(1 + penEtf.priceCAGR  / 100, (y - 1) + m / 12)
      const irpPrice  = irpEtf.price  * Math.pow(1 + irpEtf.priceCAGR  / 100, (y - 1) + m / 12)
      const normPrice = normEtf.price * Math.pow(1 + normEtf.priceCAGR / 100, (y - 1) + m / 12)

      // 납입 (연초 일시납: 1월에 모두, 월 적립: 매월)
      const isaNow  = mode === 'annual' ? (m === 1 && !isMatureYear ? annISAWan * 10000 : 0)
                                        : (!isMatureYear ? (annISAWan / 12) * 10000 : 0)
      const penNow  = mode === 'annual' ? (m === 1 ? (annPenWan + (m===1 ? penExtra : 0)) * 10000 : 0)
                                        : ((annPenWan / 12) * 10000 + (m===1 ? penExtra : 0))
      const irpNow  = mode === 'annual' ? (m === 1 ? annIRPWan * 10000 : 0)
                                        : (annIRPWan / 12) * 10000
      const normNow = mode === 'annual' ? (m === 1 ? (annISAWan + annPenWan + annIRPWan) * 10000 : 0)
                                        : ((annISAWan + annPenWan + annIRPWan) / 12) * 10000

      if (isaNow > 0) {
        isaShares    += (isaNow  / FX_RATE) / isaPrice
        isaCostBasis += isaNow
        isaContribYear += isaNow
      }
      if (penNow > 0) {
        penShares    += (penNow  / FX_RATE) / penPrice
        penContribYear += penNow
      }
      if (irpNow > 0) {
        irpShares    += (irpNow  / FX_RATE) / irpPrice
        irpContribYear += irpNow
      }
      if (normNow > 0) {
        normalShares += (normNow / FX_RATE) / normPrice
      }

      // 분기배당
      if (DIV_MONTHS.includes(m)) {
        // 절세계좌: 배당 원천징수 15% (보수적)
        const isaDiv  = isaShares  * isaDivPerPeriod  * FX_RATE * (1 - DIV_TAX_RATE)
        const penDiv  = penShares  * penDivPerPeriod  * FX_RATE * (1 - DIV_TAX_RATE)
        const irpDiv  = irpShares  * irpDivPerPeriod  * FX_RATE * (1 - DIV_TAX_RATE)
        const normDiv = normalShares * normDivPerPeriod * FX_RATE * (1 - NORMAL_DIV_TAX_RATE)

        // DRIP 재투자
        isaShares    += (isaDiv  / FX_RATE) / isaPrice
        penShares    += (penDiv  / FX_RATE) / penPrice
        irpShares    += (irpDiv  / FX_RATE) / irpPrice
        normalShares += (normDiv / FX_RATE) / normPrice
      }
    }

    // 연말 주가
    const isaEndPrice  = isaEtf.price  * Math.pow(1 + isaEtf.priceCAGR  / 100, y)
    const penEndPrice  = penEtf.price  * Math.pow(1 + penEtf.priceCAGR  / 100, y)
    const irpEndPrice  = irpEtf.price  * Math.pow(1 + irpEtf.priceCAGR  / 100, y)
    const normEndPrice = normEtf.price * Math.pow(1 + normEtf.priceCAGR / 100, y)

    totalContributed += isaContribYear + (annPenWan + (reinvestRefund ? extraPenNextYear/10000 : 0)) * 10000 + annIRPWan * 10000

    // 세액공제
    cumulativeTaxCredit += yearlyCredit
    extraPenNextYear = yearlyCredit

    let isaTransfer = 0
    let isaTransferCredit = 0

    // ISA 만기 처리
    if (isMatureYear) {
      const isaBalKRW = isaShares * isaEndPrice * FX_RATE

      // ✅ 연금저축 이체: 9.9% 없음! 전액 이체
      // (현금 인출이 아닌 연금저축 이체이므로 ISA 분리과세 미적용)
      isaTransfer = isaBalKRW
      isaTransferCredit = Math.min(isaBalKRW * 0.1, 3_000_000)
      cumulativeTaxCredit += isaTransferCredit

      // ISA → 연금저축 이체 (KRW → 주식 재매수)
      penShares += (isaBalKRW / FX_RATE) / penEndPrice

      // ISA 리셋 후 4번째 납입 (연초 일시납: 이미 연초에 납입 처리됨)
      // 만기 당해 연도의 새 ISA 납입
      const newIsaContrib = annISAWan * 10000
      const newIsaPrice = isaEtf.price * Math.pow(1 + isaEtf.priceCAGR / 100, y - 1 + 1/12)
      isaShares    = (newIsaContrib / FX_RATE) / newIsaPrice
      isaCostBasis = newIsaContrib
      totalContributed += newIsaContrib  // 4번째 납입 원금
    }

    // 연말 잔액 계산
    const isaBalance  = isaShares  * isaEndPrice  * FX_RATE
    const penBalance  = penShares  * penEndPrice  * FX_RATE
    const irpBalance  = irpShares  * irpEndPrice  * FX_RATE
    const normalBalance = normalShares * normEndPrice * FX_RATE
    const totalBalance = isaBalance + penBalance + irpBalance

    rows.push({
      year: y,
      age,
      isaBalance,
      pensionBalance: penBalance,
      irpBalance,
      totalBalance,
      isaContributed:    isaContribYear,
      pensionContributed: (annPenWan + (reinvestRefund ? extraPenNextYear/10000 : 0)) * 10000,
      irpContributed:    annIRPWan * 10000,
      taxCreditThisYear: yearlyCredit + isaTransferCredit,
      cumulativeTaxCredit,
      isaTransfer,
      isaTransferCredit,
      normalBalance,
      isMatureYear,
    })
  }

  const lastRow = rows[rows.length - 1]
  const finalBalance = lastRow?.totalBalance ?? 0

  // 연금 수령 시 세후 계산
  const pTaxRate = getPensionTaxRate(retirementAge)
  const penFinalAfterTax = (lastRow?.pensionBalance ?? 0) * (1 - pTaxRate)
  const irpFinalAfterTax = (lastRow?.irpBalance     ?? 0) * (1 - pTaxRate)
  const isaFinal         = lastRow?.isaBalance ?? 0
  const finalAfterPensionTax = isaFinal + penFinalAfterTax + irpFinalAfterTax

  // 일반계좌 세후
  const normalFinal   = lastRow?.normalBalance ?? 0
  const normalGain    = normalFinal - totalContributed
  const normalCapTax  = normalGain > 2_500_000 ? (normalGain - 2_500_000) * 0.22 : 0
  const normalAfterTax = normalFinal - normalCapTax

  // 월 연금 (20년 분할 수령 가정)
  const monthlyPension = (finalAfterPensionTax / 20 / 12)

  return {
    rows,
    totalContributed,
    finalBalance: finalAfterPensionTax,
    normalFinalBalance: normalAfterTax,
    totalTaxCredit: lastRow?.cumulativeTaxCredit ?? 0,
    taxAdvantage: finalAfterPensionTax - normalAfterTax,
    monthlyPension,
    pensionTaxRate: pTaxRate,
  }
}
