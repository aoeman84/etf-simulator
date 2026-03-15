import { NextRequest, NextResponse } from 'next/server'

// 캐시: 24시간
const CACHE: Record<string, {
  divYield: number
  divGrowthCAGR: number
  updatedAt: string
  ts: number
}> = {}
const TTL = 24 * 60 * 60 * 1000 // 24시간

// 기본값 (fallback)
const FALLBACK: Record<string, { divYield: number; divGrowthCAGR: number }> = {
  SCHD: { divYield: 3.4,  divGrowthCAGR: 11.0 },
  VOO:  { divYield: 1.3,  divGrowthCAGR: 6.0 },
  QQQ:  { divYield: 0.6,  divGrowthCAGR: 8.0 },
  VYM:  { divYield: 2.9,  divGrowthCAGR: 7.0 },
  JEPI: { divYield: 7.5,  divGrowthCAGR: 2.0 },
}

/**
 * Yahoo Finance에서 배당 히스토리 가져와서 CAGR 계산
 * - 배당수익률: 최근 12개월 배당 합계 / 현재가
 * - 배당성장 CAGR: 최근 5년치 연간 배당 합계로 CAGR 계산
 */
async function fetchDividendData(ticker: string): Promise<{
  divYield: number
  divGrowthCAGR: number
  updatedAt: string
} | null> {
  try {
    // Yahoo Finance v8 — 5년치 배당 히스토리
    const now = Math.floor(Date.now() / 1000)
    const fiveYearsAgo = now - 5 * 365 * 24 * 3600

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=3mo&range=5y&events=dividends`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ETFSimulator/1.0)',
          'Accept': 'application/json',
        },
        next: { revalidate: 86400 }, // 24시간 캐시
      }
    )

    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const currentPrice = result.meta?.regularMarketPrice
    if (!currentPrice) return null

    // 배당 이벤트 추출
    const dividends = result.events?.dividends
    if (!dividends || Object.keys(dividends).length === 0) return null

    const divEntries = Object.values(dividends) as { amount: number; date: number }[]
    divEntries.sort((a, b) => a.date - b.date)

    // 연도별 배당 합계
    const byYear: Record<number, number> = {}
    const nowDate = new Date()
    const fiveYearsAgoDate = new Date()
    fiveYearsAgoDate.setFullYear(nowDate.getFullYear() - 5)

    for (const d of divEntries) {
      const date = new Date(d.date * 1000)
      if (date < fiveYearsAgoDate) continue
      const year = date.getFullYear()
      byYear[year] = (byYear[year] ?? 0) + d.amount
    }

    const years = Object.keys(byYear).map(Number).sort()
    if (years.length < 2) return null

    // 최근 12개월 배당합 / 현재가 = 배당수익률
    const recentYear = years[years.length - 1]
    const prevYear = years[years.length - 2]
    const recentDivTotal = (byYear[recentYear] ?? 0) + (byYear[prevYear] ?? 0) / 2
    const divYield = Math.round((recentDivTotal / currentPrice) * 1000) / 10 // 소수점 1자리

    // CAGR: 첫해 vs 최근해
    const firstYear = years[0]
    const lastYear = years[years.length - 1]
    const n = lastYear - firstYear
    if (n <= 0 || !byYear[firstYear] || !byYear[lastYear]) return null

    const rawCAGR = (Math.pow(byYear[lastYear] / byYear[firstYear], 1 / n) - 1) * 100
    const divGrowthCAGR = Math.round(rawCAGR * 10) / 10 // 소수점 1자리

    // 비정상값 필터링
    if (divYield <= 0 || divYield > 30) return null
    if (divGrowthCAGR < -20 || divGrowthCAGR > 50) return null

    return {
      divYield,
      divGrowthCAGR,
      updatedAt: new Date().toISOString().split('T')[0],
    }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const fallback = FALLBACK[ticker]
  if (!fallback) return NextResponse.json({ error: 'unknown ticker' }, { status: 400 })

  // 캐시 확인
  if (CACHE[ticker] && Date.now() - CACHE[ticker].ts < TTL) {
    return NextResponse.json({ ticker, ...CACHE[ticker], cached: true })
  }

  // Yahoo Finance에서 실시간 데이터 시도
  const live = await fetchDividendData(ticker)

  if (live) {
    CACHE[ticker] = { ...live, ts: Date.now() }
    return NextResponse.json({
      ticker,
      divYield: live.divYield,
      divGrowthCAGR: live.divGrowthCAGR,
      updatedAt: live.updatedAt,
      cached: false,
      source: 'yahoo',
    })
  }

  // Fallback: 하드코딩 기본값
  return NextResponse.json({
    ticker,
    divYield: fallback.divYield,
    divGrowthCAGR: fallback.divGrowthCAGR,
    updatedAt: '2025-03',
    cached: false,
    source: 'fallback',
  })
}
