import { ETFInfo, TaxSettings, YearResult } from '@/types'
import { calcTax, DEFAULT_TAX } from './tax'

// ── ETF 기본 데이터 기준: 2025년 3월 ────────────────────────────
// 배당수익률: 최근 12개월 배당금 / 현재가
// 배당성장 CAGR: 5~10년 배당 성장률 평균
// 주가 CAGR: ETF 설정 이후 연평균 수익률
export const ETF_DATA_UPDATED_AT = '2025년 3월'

export const ETF_DATA: Record<string, ETFInfo> = {
  SCHD: {
    ticker: 'SCHD',
    name: 'Schwab US Dividend Equity ETF',
    price: 30.80,
    divYield: 3.4,
    divGrowthCAGR: 11.0,
    priceCAGR: 8.5,
    color: '#2563eb',
  },
  VOO: {
    ticker: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    price: 513.0,
    divYield: 1.3,
    divGrowthCAGR: 6.0,
    priceCAGR: 13.5,
    color: '#16a34a',
  },
  QQQ: {
    ticker: 'QQQ',
    name: 'Invesco Nasdaq-100 ETF',
    price: 468.0,
    divYield: 0.6,
    divGrowthCAGR: 8.0,
    priceCAGR: 17.2,
    color: '#9333ea',
  },
  VYM: {
    ticker: 'VYM',
    name: 'Vanguard High Dividend Yield ETF',
    price: 125.0,
    divYield: 2.9,
    divGrowthCAGR: 7.0,
    priceCAGR: 9.2,
    color: '#ea580c',
  },
  JEPI: {
    ticker: 'JEPI',
    name: 'JPMorgan Equity Premium Income ETF',
    price: 57.0,
    divYield: 7.5,
    divGrowthCAGR: 2.0,
    priceCAGR: 5.5,
    color: '#0891b2',
  },
}

/**
 * 단일 ETF 시뮬레이션
 *
 * [v1.21 버그수정]
 * - DRIP 세금 추정: 연중 누적 배당으로 연간 예상치를 과대추정하는 버그 수정
 *   → 전년도 연간 실효세율을 사용해 당해연도 DRIP 세금 차감
 *   → 1년차는 원천징수 15%만 적용 (종합소득세 기준 데이터 없음)
 * - 분기배당: SCHD/VOO/QQQ/VYM → 3/6/9/12월, JEPI → 매월
 * - DRIP: 세후 배당금으로 재투자
 */
export function simulate(
  etf: ETFInfo,
  monthlyKRW: number,
  years: number,
  fxRate: number,
  drip: boolean,
  tax: TaxSettings = DEFAULT_TAX
): YearResult[] {
  const results: YearResult[] = []
  let totalShares = 0
  let totalInvested = 0

  const startDivPerShare = etf.price * (etf.divYield / 100)
  const priceCAGR = etf.priceCAGR / 100
  const divGrowth = etf.divGrowthCAGR / 100

  // JEPI는 월배당, 나머지는 분기배당 (3/6/9/12월)
  const isMonthlyDiv = etf.ticker === 'JEPI'
  const divMonths = isMonthlyDiv
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    : [3, 6, 9, 12]

  // 전년도 실효세율 (DRIP 계산용) — 1년차는 원천징수 15%만
  let prevYearEffectiveRate = tax.enabled && tax.withholdingTax ? 0.15 : 0

  for (let y = 1; y <= years; y++) {
    const priceEnd = etf.price * Math.pow(1 + priceCAGR, y)
    const divPerShare = startDivPerShare * Math.pow(1 + divGrowth, y - 1)
    const divPerPeriod = isMonthlyDiv ? divPerShare / 12 : divPerShare / 4

    let annualDivUSD = 0

    for (let m = 1; m <= 12; m++) {
      const priceMonth = etf.price * Math.pow(1 + priceCAGR, (y - 1) + m / 12)
      const usdAmount = monthlyKRW / fxRate
      totalShares += usdAmount / priceMonth
      totalInvested += monthlyKRW

      if (divMonths.includes(m)) {
        const periodDivUSD = totalShares * divPerPeriod
        annualDivUSD += periodDivUSD

        // DRIP: 전년도 실효세율 기준으로 세후 금액 재투자
        // → 연중 과대추정 없이 안정적으로 계산
        if (drip) {
          const periodDivKRW = periodDivUSD * fxRate
          const afterTaxDivKRW = periodDivKRW * (1 - prevYearEffectiveRate)
          totalShares += (afterTaxDivKRW / fxRate) / priceMonth
        }
      }
    }

    const portfolioKRW = totalShares * priceEnd * fxRate
    const annualDivKRW = annualDivUSD * fxRate
    const gainKRW = portfolioKRW - totalInvested

    // 연간 실제 세금 계산 (표시용)
    const taxResult = calcTax(annualDivKRW, gainKRW, tax)

    // 다음 연도 DRIP 세금 추정에 쓸 실효세율 업데이트
    if (annualDivKRW > 0) {
      prevYearEffectiveRate = taxResult.totalDivTaxKRW / annualDivKRW
    }

    results.push({
      year: y,
      invested: totalInvested,
      portfolioKRW,
      gainKRW,
      gainPct: (gainKRW / totalInvested) * 100,
      annualDivKRW,
      monthlyDivKRW: annualDivKRW / 12,
      tax: taxResult,
    })
  }

  return results
}

/**
 * 분산투자 시뮬레이션 — 여러 ETF를 동시에 매수
 */
export function simulateMulti(
  allocations: { ticker: string; monthlyKRW: number }[],
  years: number,
  fxRate: number,
  drip: boolean,
  tax: TaxSettings = DEFAULT_TAX,
  scenario?: { priceCAGRAdj: number; divGrowthAdj: number; mode: string }
): YearResult[] {
  const allResults = allocations.map(({ ticker, monthlyKRW }) => {
    const etf = { ...ETF_DATA[ticker] }
    if (scenario) {
      if (scenario.mode === 'pessimistic') {
        etf.priceCAGR = etf.priceCAGR * 0.5
        etf.divGrowthCAGR = 0
      } else {
        etf.priceCAGR = Math.max(0, etf.priceCAGR + scenario.priceCAGRAdj)
        etf.divGrowthCAGR = Math.max(0, etf.divGrowthCAGR + scenario.divGrowthAdj)
      }
    }
    return simulate(etf, monthlyKRW, years, fxRate, drip, tax)
  })

  return Array.from({ length: years }, (_, i) => {
    const y = i + 1
    const invested     = allResults.reduce((s, r) => s + (r[i]?.invested ?? 0), 0)
    const portfolioKRW = allResults.reduce((s, r) => s + (r[i]?.portfolioKRW ?? 0), 0)
    const annualDivKRW = allResults.reduce((s, r) => s + (r[i]?.annualDivKRW ?? 0), 0)
    const gainKRW = portfolioKRW - invested
    const taxResult = calcTax(annualDivKRW, gainKRW, tax)
    return {
      year: y,
      invested,
      portfolioKRW,
      gainKRW,
      gainPct: invested > 0 ? (gainKRW / invested) * 100 : 0,
      annualDivKRW,
      monthlyDivKRW: annualDivKRW / 12,
      tax: taxResult,
    }
  })
}

export function fmtKRW(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const eok = Math.floor(abs / 1e8)
  const man = Math.floor((abs % 1e8) / 1e4)
  if (eok > 0 && man > 0) return `${sign}${eok}억 ${man}만원`
  if (eok > 0) return `${sign}${eok}억원`
  return `${sign}${man}만원`
}
