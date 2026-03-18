/**
 * ETF 연간 총수익률 (%) — 배당 포함 토탈 리턴
 * 출처: 각 ETF 실제 운용 역사 기반 추정치 (투자 참고용)
 */
export const HISTORICAL_RETURNS: Record<string, Record<number, number>> = {
  QQQ: {
    2000: -36.84,
    2001: -32.65,
    2002: -37.58,
    2003:  50.01,
    2004:  10.44,
    2005:   1.49,
    2006:   6.98,
    2007:  18.67,
    2008: -41.73,
    2009:  54.65,
    2010:  20.00,
    2011:   3.27,
    2012:  18.12,
    2013:  36.58,
    2014:  19.24,
    2015:   9.42,
    2016:   7.06,
    2017:  32.68,
    2018:  -0.12,
    2019:  38.96,
    2020:  48.62,
    2021:  27.27,
    2022: -32.58,
    2023:  54.85,
    2024:  25.44,
  },
  VOO: {
    2011:   2.09,
    2012:  16.00,
    2013:  32.36,
    2014:  13.65,
    2015:   1.37,
    2016:  11.95,
    2017:  21.79,
    2018:  -4.43,
    2019:  31.47,
    2020:  18.35,
    2021:  28.71,
    2022: -18.16,
    2023:  26.18,
    2024:  23.31,
  },
  SCHD: {
    2012:  13.41,
    2013:  29.34,
    2014:  13.47,
    2015:  -1.68,
    2016:  18.90,
    2017:  18.98,
    2018:  -5.70,
    2019:  27.91,
    2020:  11.00,
    2021:  27.87,
    2022:  -3.22,
    2023:  -4.35,
    2024:  24.18,
  },
  VYM: {
    2007:  -1.5,
    2008: -32.1,
    2009:  21.5,
    2010:  15.9,
    2011:   8.9,
    2012:  14.5,
    2013:  29.4,
    2014:  11.7,
    2015:  -2.8,
    2016:  17.3,
    2017:  16.0,
    2018:  -5.7,
    2019:  26.3,
    2020:   1.7,
    2021:  28.2,
    2022:  -0.4,
    2023:   6.6,
    2024:  17.6,
  },
  JEPI: {
    2020:   8.2,
    2021:  21.5,
    2022:  -3.5,
    2023:   9.8,
    2024:   9.1,
  },
}

export type BacktestYearRow = {
  year: number
  returnPct: number
  balance: number   // 만원
  invested: number  // 만원 (누적)
  gainLoss: number  // 만원 (balance - invested)
}

/**
 * DCA 백테스트 시뮬레이션
 * @param ticker  - 'SCHD' | 'VOO' | 'QQQ'
 * @param startYear - 시작 연도
 * @param endYear   - 종료 연도
 * @param monthlyWan - 월 납입액 (만원)
 */
export function runBacktest(
  ticker: string,
  startYear: number,
  endYear: number,
  monthlyWan: number,
): BacktestYearRow[] {
  const returns = HISTORICAL_RETURNS[ticker] ?? {}
  const results: BacktestYearRow[] = []
  let balance = 0
  let totalInvested = 0

  for (let year = startYear; year <= endYear; year++) {
    const ret = returns[year]
    if (ret === undefined) continue
    const annualInvest = monthlyWan * 12
    totalInvested += annualInvest
    // DCA 근사: 기존 잔액 전체 수익, 신규 납입은 평균 절반 수익
    const r = ret / 100
    balance = balance * (1 + r) + annualInvest * (1 + r / 2)
    results.push({
      year,
      returnPct: ret,
      balance: Math.round(balance),
      invested: totalInvested,
      gainLoss: Math.round(balance - totalInvested),
    })
  }
  return results
}

export function calcCAGR(startBalance: number, endBalance: number, years: number): number {
  if (years <= 0 || startBalance <= 0) return 0
  return (Math.pow(endBalance / startBalance, 1 / years) - 1) * 100
}

export function calcMDD(rows: BacktestYearRow[]): number {
  let peak = 0
  let mdd = 0
  for (const row of rows) {
    if (row.balance > peak) peak = row.balance
    const drawdown = peak > 0 ? (row.balance - peak) / peak * 100 : 0
    if (drawdown < mdd) mdd = drawdown
  }
  return mdd
}
