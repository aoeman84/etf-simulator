import { NextResponse } from 'next/server'

let cache: { rate: number; ts: number } | null = null
const TTL = 10 * 60 * 1000

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json({ rate: cache.rate, cached: true })
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 600 }
    })
    const data = await res.json()
    const rate = data?.rates?.KRW
    if (!rate) throw new Error('no rate')
    const rounded = Math.round(rate / 10) * 10
    cache = { rate: rounded, ts: Date.now() }
    return NextResponse.json({ rate: rounded, cached: false })
  } catch {
    return NextResponse.json({ rate: 1350, cached: false, fallback: true })
  }
}
