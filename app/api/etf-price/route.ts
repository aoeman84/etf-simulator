import { NextRequest, NextResponse } from 'next/server'

const CACHE: Record<string, { price: number; change: number; changePct: number; ts: number }> = {}
const HIST_CACHE: Record<string, { price: number; tradingDate: string; ts: number }> = {}
const RANGE_CACHE: Record<string, { history: { date: string; close: number }[]; ts: number }> = {}
const TTL = 5 * 60 * 1000
const HIST_TTL = 24 * 60 * 60 * 1000
const RANGE_TTL = 60 * 60 * 1000 // 1시간

// 정적 전일종가 (fallback용)
const PREV_CLOSE: Record<string, number> = {
  SCHD: 30.82, VOO: 513.0, QQQ: 468.0, VYM: 125.0, JEPI: 57.0,
}

const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ETFSimulator/1.0)',
  'Accept': 'application/json',
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  const date = req.nextUrl.searchParams.get('date') // YYYY-MM-DD
  const start = req.nextUrl.searchParams.get('start') // YYYY-MM-DD
  const end = req.nextUrl.searchParams.get('end')     // YYYY-MM-DD

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // ── 기간 조회: start + end → 일별 종가 배열 반환 ──
  if (start && end) {
    const cacheKey = `${ticker}_range_${start}_${end}`
    if (RANGE_CACHE[cacheKey] && Date.now() - RANGE_CACHE[cacheKey].ts < RANGE_TTL) {
      return NextResponse.json({ ticker, history: RANGE_CACHE[cacheKey].history, cached: true })
    }
    try {
      const period1 = Math.floor(new Date(start).getTime() / 1000)
      const period2 = Math.floor(new Date(end).getTime() / 1000) + 86400
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${period1}&period2=${period2}`,
        { headers: YF_HEADERS, next: { revalidate: 3600 } }
      )
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      const timestamps: number[] = result?.timestamp ?? []
      const closes: number[] = result?.indicators?.quote?.[0]?.close ?? []
      const history = timestamps
        .map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().split('T')[0],
          close: closes[i] != null ? Math.round(closes[i] * 100) / 100 : null,
        }))
        .filter((d): d is { date: string; close: number } => d.close !== null && d.close > 0)
      RANGE_CACHE[cacheKey] = { history, ts: Date.now() }
      return NextResponse.json({ ticker, history, cached: false })
    } catch {}
    return NextResponse.json({ ticker, history: [], error: 'fetch failed' })
  }

  // ── 날짜 지정 시 역사적 종가 조회 ──
  if (date) {
    const cacheKey = `${ticker}_${date}`
    if (HIST_CACHE[cacheKey] && Date.now() - HIST_CACHE[cacheKey].ts < HIST_TTL) {
      const c = HIST_CACHE[cacheKey]
      return NextResponse.json({ ticker, price: c.price, date, tradingDate: c.tradingDate, cached: true })
    }
    try {
      // 요청일 기준 ±5거래일 범위로 넓혀서 조회 (휴장일 대응)
      const d = new Date(date)
      const period1 = Math.floor(d.getTime() / 1000) - 5 * 86400
      const period2 = Math.floor(d.getTime() / 1000) + 5 * 86400
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${period1}&period2=${period2}`,
        { headers: YF_HEADERS, next: { revalidate: 86400 } }
      )
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      const timestamps: number[] = result?.timestamp ?? []
      const closes: number[] = result?.indicators?.quote?.[0]?.close ?? []

      if (timestamps.length > 0 && closes.length > 0) {
        const targetTs = Math.floor(d.getTime() / 1000)
        // 요청 날짜보다 작거나 같은 가장 가까운 거래일 선택
        let bestIdx = 0
        let bestDiff = Infinity
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] == null) continue
          const diff = targetTs - timestamps[i]
          if (diff >= 0 && diff < bestDiff) {
            bestDiff = diff
            bestIdx = i
          }
        }
        const close = closes[bestIdx]
        if (close && close > 0) {
          const price = Math.round(close * 100) / 100
          const tradingDate = new Date(timestamps[bestIdx] * 1000).toISOString().split('T')[0]
          HIST_CACHE[cacheKey] = { price, tradingDate, ts: Date.now() }
          return NextResponse.json({ ticker, price, date, tradingDate, cached: false })
        }
      }
    } catch {}
    return NextResponse.json({ ticker, price: null, date, fallback: true })
  }

  if (CACHE[ticker] && Date.now() - CACHE[ticker].ts < TTL) {
    return NextResponse.json({ ticker, ...CACHE[ticker], cached: true })
  }

  // 1순위: Yahoo Finance 무료 API (키 불필요)
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { headers: YF_HEADERS, next: { revalidate: 300 } }
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
