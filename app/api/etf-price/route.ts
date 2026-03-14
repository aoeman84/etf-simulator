import { NextRequest, NextResponse } from 'next/server'

const CACHE: Record<string, { price: number; change: number; changePct: number; ts: number }> = {}
const TTL = 5 * 60 * 1000

// 정적 전일종가 (fallback용)
const PREV_CLOSE: Record<string, number> = {
  SCHD: 30.82, VOO: 513.0, QQQ: 468.0, VYM: 125.0, JEPI: 57.0,
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  if (CACHE[ticker] && Date.now() - CACHE[ticker].ts < TTL) {
    return NextResponse.json({ ticker, ...CACHE[ticker], cached: true })
  }

  // 1순위: Yahoo Finance 무료 API (키 불필요)
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ETFSimulator/1.0)',
          'Accept': 'application/json',
        },
        next: { revalidate: 300 },
      }
    )
    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    const price = meta?.regularMarketPrice
    const prev = meta?.previousClose ?? meta?.chartPreviousClose
    if (price && prev) {
      const change = price - prev
      const changePct = (change / prev) * 100
      CACHE[ticker] = { price, change, changePct, ts: Date.now() }
      return NextResponse.json({ ticker, price, change, changePct, cached: false })
    }
    throw new Error('no price from yahoo free')
  } catch {}

  // 2순위: RapidAPI (키 있을 때)
  if (process.env.RAPIDAPI_KEY) {
    try {
      const res = await fetch(
        `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${ticker}&type=ETF`,
        {
          headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': process.env.RAPIDAPI_HOST ?? 'yahoo-finance15.p.rapidapi.com',
          },
          next: { revalidate: 300 },
        }
      )
      const data = await res.json()
      const body = data?.body
      const price = body?.regularMarketPrice
      const change = body?.regularMarketChange ?? 0
      const changePct = body?.regularMarketChangePercent ?? 0
      if (price) {
        CACHE[ticker] = { price, change, changePct, ts: Date.now() }
        return NextResponse.json({ ticker, price, change, changePct, cached: false })
      }
    } catch {}
  }

  // 3순위: 정적 fallback
  const price = PREV_CLOSE[ticker] ?? null
  return NextResponse.json({ ticker, price, change: null, changePct: null, fallback: true })
}
