import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const portfolios = await prisma.portfolio.findMany({
    where: { userId: (session.user as any).id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(portfolios)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, settings } = await req.json()
  if (!name || !settings) return NextResponse.json({ error: 'name and settings required' }, { status: 400 })

  const portfolio = await prisma.portfolio.create({
    data: {
      name,
      settings,
      userId: (session.user as any).id,
    },
  })
  return NextResponse.json(portfolio, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.portfolio.deleteMany({
    where: { id, userId: (session.user as any).id },
  })
  return NextResponse.json({ ok: true })
}
