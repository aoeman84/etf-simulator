'use client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { YearResult } from '@/types'
import { ETF_DATA } from '@/lib/simulator'

function fmt(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  return `${(n / 1e4).toFixed(0)}만`
}

export default function CompareChart({
  results, years,
}: {
  results: Record<string, YearResult[]>
  years: number
}) {
  const tickers = Object.keys(results)
  if (tickers.length === 0) return null

  const data = Array.from({ length: years }, (_, i) => {
    const row: Record<string, number | string> = { year: `${i + 1}년` }
    tickers.forEach(t => {
      row[t] = Math.round((results[t]?.[i]?.portfolioKRW ?? 0) / 1e4)
    })
    return row
  })

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tickFormatter={v => fmt(v * 1e4)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip
          formatter={(v: number, name: string) => [fmt(v * 1e4) + '원', name]}
          contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        {tickers.map(t => (
          <Line key={t} type="monotone" dataKey={t}
            stroke={ETF_DATA[t]?.color ?? '#888'}
            strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
