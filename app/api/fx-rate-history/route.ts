import { NextResponse } from 'next/server'

// 날짜별 환율 캐시
const cache: Record<string, { rate: number; ts: number }> = {}
const TTL = 60 * 60 * 1000 // 1시간 (과거 환율은 바뀌지 않으므로 길게)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: 'date required' }, { status: 400 })
  }

  // 캐시 확인
  if (cache[date] && Date.now() - cache[date].ts < TTL) {
    return NextResponse.json({ rate: cache[date].rate, cached: true })
  }

  try {
    // exchangerate.host 무료 API - 과거 날짜 지원
    const res = await fetch(
      `https://api.exchangerate.host/${date}?base=USD&symbols=KRW`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const rate = data?.rates?.KRW

    if (!rate) throw new Error('no rate')

    const rounded = Math.round(rate / 10) * 10
    cache[date] = { rate: rounded, ts: Date.now() }
    return NextResponse.json({ rate: rounded, date, cached: false })
  } catch {
    // fallback: open.er-api 현재 환율
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
