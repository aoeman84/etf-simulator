import { NextResponse } from 'next/server'

const cache: Record<string, { rate: number; ts: number }> = {}
const TTL = 24 * 60 * 60 * 1000 // 과거 환율은 24시간 캐시

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 })
  }

  // 캐시 확인
  if (cache[date] && Date.now() - cache[date].ts < TTL) {
    return NextResponse.json({ rate: cache[date].rate, date, cached: true })
  }

  try {
    // fawazahmed0 currency API — 날짜별, KRW 지원, 완전 무료
    const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.min.json`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    const data = await res.json()
    const rate = data?.usd?.krw

    if (!rate) throw new Error('no KRW rate')

    const rounded = Math.round(rate / 10) * 10
    cache[date] = { rate: rounded, ts: Date.now() }
    return NextResponse.json({ rate: rounded, date, cached: false })
  } catch {
    // fallback: 현재 환율
    try {
      const res2 = await fetch('https://open.er-api.com/v6/latest/USD')
      const data2 = await res2.json()
      const rate2 = data2?.rates?.KRW
      if (rate2) {
        const rounded = Math.round(rate2 / 10) * 10
        return NextResponse.json({ rate: rounded, date, cached: false, fallback: true })
      }
    } catch {}
    return NextResponse.json({ rate: 1350, date, cached: false, fallback: true })
  }
}
