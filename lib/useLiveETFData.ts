'use client'
import { useEffect, useState } from 'react'
import { ETF_DATA } from './simulator'

export interface LiveETFData {
  ticker: string
  divYield: number
  divGrowthCAGR: number
  updatedAt: string
  source: 'yahoo' | 'fallback'
}

/**
 * ETF 배당수익률 / 배당성장률 자동갱신 훅
 * - 컴포넌트 마운트 시 Yahoo Finance에서 최신 데이터 조회
 * - 실패 시 기존 하드코딩 값 유지
 * - 성공 시 ETF_DATA를 런타임에서 업데이트
 */
export function useLiveETFData(tickers: string[]) {
  const [liveData, setLiveData] = useState<Record<string, LiveETFData>>({})
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!tickers.length) return
    setLoading(true)

    Promise.allSettled(
      tickers.map(ticker =>
        fetch(`/api/etf-dividend?ticker=${ticker}`)
          .then(r => r.json())
          .then((data): LiveETFData | null => {
            if (data.divYield && data.divGrowthCAGR) {
              return {
                ticker,
                divYield: data.divYield,
                divGrowthCAGR: data.divGrowthCAGR,
                updatedAt: data.updatedAt,
                source: data.source,
              }
            }
            return null
          })
          .catch(() => null)
      )
    ).then(results => {
      const updates: Record<string, LiveETFData> = {}
      let latestUpdate = ''

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          const d = result.value
          updates[d.ticker] = d
          // ETF_DATA 런타임 업데이트 (yahoo 소스인 경우만)
          if (d.source === 'yahoo' && ETF_DATA[d.ticker]) {
            ETF_DATA[d.ticker].divYield = d.divYield
            ETF_DATA[d.ticker].divGrowthCAGR = d.divGrowthCAGR
          }
          if (d.updatedAt > latestUpdate) latestUpdate = d.updatedAt
        }
      })

      setLiveData(updates)
      if (latestUpdate) setUpdatedAt(latestUpdate)
      setLoading(false)
    })
  }, [tickers.join(',')])

  return { liveData, loading, updatedAt }
}
