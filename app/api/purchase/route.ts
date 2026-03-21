import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const records = await prisma.purchaseRecord.findMany({
    where: { userId: (session.user as any).id },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, date, amountKRW, fxRate, etfPrice } = await req.json()
  if (!ticker || !date || !amountKRW || !fxRate) {
    return NextResponse.json({ error: 'ticker, date, amountKRW, fxRate required' }, { status: 400 })
  }

  const record = await prisma.purchaseRecord.create({
    data: {
      userId: (session.user as any).id,
      ticker,
      date,
      amountKRW: Number(amountKRW),
      fxRate: Number(fxRate),
      etfPrice: etfPrice != null ? Number(etfPrice) : null,
    },
  })
  return NextResponse.json(record, { status: 201 })
}
