'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { YearResult } from '@/types'

function fmt(n: number) {
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억`
  return `${(n / 1e4).toFixed(0)}만`
}

export default function SimChart({ results, taxEnabled }: { results: YearResult[], taxEnabled?: boolean }) {
  const data = results.map(r => ({
    year: `${r.year}년`,
    투자원금: Math.round(r.invested / 1e4),
    평가이익: Math.round(r.gainKRW / 1e4),
    배당금: Math.round((taxEnabled ? r.tax.afterTaxDivKRW : r.annualDivKRW) / 1e4),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tickFormatter={v => fmt(v * 1e4)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip
          formatter={(v: number, name: string) => [fmt(v * 1e4) + '원', name]}
          contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
        <Bar dataKey="투자원금" stackId="a" fill="#94a3b8" />
        <Bar dataKey="평가이익" stackId="a" fill="#2563eb" />
        <Bar dataKey="배당금"   stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
