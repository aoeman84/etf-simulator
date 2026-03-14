'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ETF_DATA, simulate, fmtKRW } from '@/lib/simulator'
import { PortfolioSave, SimSettings, YearResult } from '@/types'

export default function PortfolioPage() {
  const { status } = useSession()
  if (status === 'unauthenticated') redirect('/login')

  const router = useRouter()
  const [portfolios, setPortfolios] = useState<PortfolioSave[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portfolio')
      .then(r => r.json())
      .then(data => { setPortfolios(data); setLoading(false) })
  }, [])

  async function deletePortfolio(id: string) {
    setDeleting(id)
    await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' })
    setPortfolios(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  function loadInSimulator(settings: SimSettings) {
    const params = new URLSearchParams({
      monthly: String(settings.monthlyKRW / 10000),
      years: String(settings.years),
      fx: String(settings.fxRate),
      drip: String(settings.drip),
      ticker: settings.etfs?.[0] ?? 'SCHD',
    })
    router.push(`/dashboard?${params.toString()}`)
  }

  function getSummary(settings: SimSettings): YearResult | null {
    const ticker = settings.etfs?.[0] ?? 'SCHD'
    const etf = ETF_DATA[ticker]
    if (!etf) return null
    const res = simulate(etf, settings.monthlyKRW, settings.years, settings.fxRate, settings.drip)
    return res[res.length - 1] ?? null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-4">

        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400">불러오는 중...</div>
        ) : portfolios.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-4">📂</div>
            <p className="text-slate-500 mb-4">저장된 포트폴리오가 없습니다.</p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary">
              시뮬레이터로 이동
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {portfolios.map(p => {
              const settings = p.settings as SimSettings
              const ticker = settings.etfs?.[0] ?? 'SCHD'
              const summary = getSummary(settings)
              return (
                <div key={p.id} className="card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{p.name}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(p.createdAt).toLocaleDateString('ko-KR')} 저장
                      </p>
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-medium">
                      {ticker}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">월 투자금</div>
                      <div className="font-medium">{(settings.monthlyKRW / 10000).toLocaleString()}만원</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <div className="text-xs text-slate-400">기간</div>
                      <div className="font-medium">{settings.years}년</div>
                    </div>
                    {summary && (
                      <>
                        <div className="bg-green-50 rounded-lg p-2">
                          <div className="text-xs text-green-600">예상 포트폴리오</div>
                          <div className="font-semibold text-green-700">{fmtKRW(summary.portfolioKRW)}</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2">
                          <div className="text-xs text-amber-600">월 배당금</div>
                          <div className="font-semibold text-amber-700">{fmtKRW(summary.monthlyDivKRW)}</div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => loadInSimulator(settings)}
                      className="btn-primary flex-1 text-sm py-1.5">
                      시뮬레이터에서 열기
                    </button>
                    <button
                      onClick={() => deletePortfolio(p.id)}
                      disabled={deleting === p.id}
                      className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-100">
                      {deleting === p.id ? '...' : '삭제'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
