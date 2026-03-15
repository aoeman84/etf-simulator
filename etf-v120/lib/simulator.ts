import { ETFInfo, TaxSettings, YearResult } from '@/types'
import { calcTax, DEFAULT_TAX } from './tax'

// ── ETF 기본 데이터 (2025년 기준) ────────────────────────────────
// 배당수익률: 최근 12개월 배당금 / 현재가
// 배당성장 CAGR: 5~10년 배당 성장률 평균
// 주가 CAGR: 설정 이후 연평균 수익률
export const ETF_DATA: Record<string, ETFInfo> = {
  SCHD: {
    ticker: 'SCHD',
    name: 'Schwab US Dividend Equity ETF',
    price: 30.80,
    divYield: 3.4,
    divGrowthCAGR: 11.0,   // 최근 5년 평균 하향 조정 (13% → 11%)
    priceCAGR: 8.5,         // 2011~2024 평균 (8.86% → 8.5% 보수적 조정)
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
    divGrowthCAGR: 7.0,    // 7.5% → 7.0% 소폭 조정
    priceCAGR: 9.2,
    color: '#ea580c',
  },
  JEPI: {
    ticker: 'JEPI',
    name: 'JPMorgan Equity Premium Income ETF',
    price: 57.0,
    divYield: 7.5,
    divGrowthCAGR: 2.0,    // 커버드콜 특성상 배당성장 제한 (3% → 2%)
    priceCAGR: 5.5,
    color: '#0891b2',
  },
}

/**
 * 단일 ETF 시뮬레이션
 *
 * [v1.20 개선사항]
 * - 분기별 배당 지급 모델: SCHD/VOO/QQQ/VYM은 분기배당, JEPI는 월배당
 * - DRIP: 세후 배당금으로 재투자 (원천징수 15% + 종합소득세 추정 반영)
 * - 월별 적립 → 분기 배당 → 분기 재투자 순서로 정확한 복리 계산
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

  for (let y = 1; y <= years; y++) {
    const priceEnd = etf.price * Math.pow(1 + priceCAGR, y)
    // 배당성장: 전년도 기준으로 성장 (y-1년 말 기준)
    const divPerShare = startDivPerShare * Math.pow(1 + divGrowth, y - 1)
    // 분기배당이면 1회당 divPerShare/4, 월배당이면 divPerShare/12
    const divPerPeriod = isMonthlyDiv ? divPerShare / 12 : divPerShare / 4

    let annualDivUSD = 0

    for (let m = 1; m <= 12; m++) {
      // 월별 매수 가격 (선형 보간)
      const priceMonth = etf.price * Math.pow(1 + priceCAGR, (y - 1) + m / 12)
      const usdAmount = monthlyKRW / fxRate
      totalShares += usdAmount / priceMonth
      totalInvested += monthlyKRW

      // 배당 지급 월인지 확인
      if (divMonths.includes(m)) {
        const periodDivUSD = totalShares * divPerPeriod
        annualDivUSD += periodDivUSD

        // DRIP: 세후 배당으로 재투자
        if (drip) {
          const periodDivKRW = periodDivUSD * fxRate
          let afterTaxDivKRW = periodDivKRW

          if (tax.enabled && tax.withholdingTax) {
            // 원천징수 15% 차감
            afterTaxDivKRW = periodDivKRW * 0.85
          }

          // 종합소득세 추정: 연간 배당 예상치로 초과분 추정
          // 연간 예상 배당 = 현재까지 누적 배당 / 경과월 * 12
          const estimatedAnnualDivKRW = annualDivUSD * fxRate * (12 / m)
          const otherFinancial = tax.otherFinancialIncomeKRW ?? 0
          const estimatedTotalFinancial = estimatedAnnualDivKRW + otherFinancial

          if (
            tax.enabled &&
            tax.comprehensiveIncomeTax &&
            estimatedTotalFinancial > 20_000_000
          ) {
            // 종합소득세 추가 부담 비율 추정 (연간 기준으로 월할 차감)
            const annualTax = calcTax(estimatedAnnualDivKRW, 0, tax)
            const effectiveRate = estimatedAnnualDivKRW > 0
              ? annualTax.totalDivTaxKRW / estimatedAnnualDivKRW
              : 0.15
            afterTaxDivKRW = periodDivKRW * (1 - effectiveRate)
          }

          totalShares += (afterTaxDivKRW / fxRate) / priceMonth
        }
      }
    }

    const portfolioKRW = totalShares * priceEnd * fxRate
    const annualDivKRW = annualDivUSD * fxRate
    const gainKRW = portfolioKRW - totalInvested
    const taxResult = calcTax(annualDivKRW, gainKRW, tax)

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
