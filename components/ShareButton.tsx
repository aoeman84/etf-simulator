'use client'
import { useState } from 'react'
import { YearResult } from '@/types'
import { fmtKRW } from '@/lib/simulator'

interface Props {
  results: YearResult[]
  allocations: { ticker: string; monthly: number }[]
  years: number
  taxEnabled: boolean
}

export default function ShareButton({ results, allocations, years, taxEnabled }: Props) {
  const [copied, setCopied] = useState(false)
  const last = results[results.length - 1]
  if (!last) return null

  const tickers = allocations.map(a => `${a.ticker} ${a.monthly}만원`).join(' + ')
  const portfolio = fmtKRW(last.portfolioKRW)
  const div = fmtKRW(taxEnabled ? last.tax.afterTaxMonthlyDivKRW : last.monthlyDivKRW)
  const gain = last.gainPct.toFixed(1)

  const text = `📈 ETF 적립식 투자 시뮬레이션 결과\n\n💼 투자: ${tickers}\n⏱ 기간: ${years}년\n\n` +
    `🏦 최종 포트폴리오: ${portfolio}\n` +
    `💰 월 배당금: ${div}${taxEnabled ? ' (세후)' : ''}\n` +
    `📊 수익률: +${gain}%\n\n` +
    `🔗 직접 계산해보기: https://etf-simulator-henna.vercel.app`

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ETF 시뮬레이션 결과', text })
        return
      } catch {}
    }
    // 공유 API 없으면 클립보드 복사
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button onClick={share}
      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all">
      {copied ? '✅ 복사됨!' : '📤 공유'}
    </button>
  )
}
