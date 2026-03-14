import { ETFInfo, TaxSettings, YearResult } from '@/types'
import { calcTax, DEFAULT_TAX } from './tax'

export const ETF_DATA: Record<string, ETFInfo> = {
  SCHD: {
    ticker: 'SCHD',
    name: 'Schwab US Dividend Equity ETF',
    price: 30.82,
    divYield: 3.4,
    divGrowthCAGR: 13.05,
    priceCAGR: 8.86,
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
    divGrowthCAGR: 7.5,
    priceCAGR: 9.2,
    color: '#ea580c',
  },
  JEPI: {
    ticker: 'JEPI',
    name: 'JPMorgan Equity Premium Income ETF',
    price: 57.0,
    divYield: 7.5,
    divGrowthCAGR: 3.0,
    priceCAGR: 5.5,
    color: '#0891b2',
  },
}

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

  for (let y = 1; y <= years; y++) {
    const priceEnd = etf.price * Math.pow(1 + priceCAGR, y)
    const divPerShare = startDivPerShare * Math.pow(1 + divGrowth, y - 1)
    let annualDivUSD = 0

    for (let m = 1; m <= 12; m++) {
      const priceMonth = etf.price * Math.pow(1 + priceCAGR, (y - 1) + m / 12)
      const usdAmount = monthlyKRW / fxRate
      totalShares += usdAmount / priceMonth
      totalInvested += monthlyKRW

      const mDivUSD = (totalShares * divPerShare) / 12
      annualDivUSD += mDivUSD

      // DRIP: 세후 배당금으로 재투자 (세금 떼고 남은 돈으로 재투자)
      if (drip) {
        const mDivKRW = mDivUSD * fxRate
        const mDivAfterTax = tax.enabled && tax.withholdingTax
          ? mDivKRW * 0.85   // 원천징수 15% 제외 후 재투자
          : mDivKRW
        totalShares += (mDivAfterTax / fxRate) / priceMonth
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

// 분산투자 시뮬레이션 — 여러 ETF를 동시에 매수
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
    const invested    = allResults.reduce((s, r) => s + (r[i]?.invested ?? 0), 0)
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
