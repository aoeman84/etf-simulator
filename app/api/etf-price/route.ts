import { NextRequest, NextResponse } from 'next/server'

const CACHE: Record<string, { price: number; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // Return cached if fresh
  if (CACHE[ticker] && Date.now() - CACHE[ticker].ts < CACHE_TTL) {
    return NextResponse.json({ ticker, price: CACHE[ticker].price, cached: true })
  }

  try {
    const res = await fetch(
      `https://yahoo-finance15.p.rapidapi.com/api/v1/markets/quote?ticker=${ticker}&type=ETF`,
      {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
          'X-RapidAPI-Host': process.env.RAPIDAPI_HOST!,
        },
        next: { revalidate: 300 },
      }
    )
    const data = await res.json()
    const price = data?.body?.regularMarketPrice

    if (!price) throw new Error('Price not found')

    CACHE[ticker] = { price, ts: Date.now() }
    return NextResponse.json({ ticker, price, cached: false })
  } catch {
    // Fallback to static data if API fails
    const fallback: Record<string, number> = {
      SCHD: 30.82, VOO: 513.0, QQQ: 468.0, VYM: 125.0, JEPI: 57.0,
    }
    return NextResponse.json({
      ticker,
      price: fallback[ticker] ?? null,
      cached: false,
      fallback: true,
    })
  }
}
