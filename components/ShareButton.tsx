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

  const text =
    `📈 ETF 적립식 투자 시뮬레이션 결과\n\n` +
    `💼 투자: ${tickers}\n⏱ 기간: ${years}년\n\n` +
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
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <button
      onClick={share}
      title="결과 공유"
      className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all ${
        copied
          ? 'border-green-300 bg-green-50 text-green-600'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
      }`}
    >
      {copied ? (
        // 체크 아이콘
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
        </svg>
      ) : (
        // 공유 아이콘 (업로드 화살표)
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
          <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
        </svg>
      )}
    </button>
  )
}
