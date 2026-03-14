'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'

const PAGE_INFO: Record<string, { title: string; desc: string }> = {
  '/dashboard': { title: 'ETF 적립식 시뮬레이터', desc: '배당 재투자(DRIP) 복리 분석' },
  '/compare':   { title: 'ETF 비교',              desc: '동일 조건으로 ETF별 성과 비교' },
  '/portfolio': { title: '내 포트폴리오',          desc: '저장된 시뮬레이션 불러오기' },
}

const LINKS = [
  { href: '/dashboard', label: '시뮬레이터', icon: '📊' },
  { href: '/compare',   label: 'ETF 비교',   icon: '📉' },
  { href: '/portfolio', label: '포트폴리오', icon: '💼' },
]

interface Props {
  rightSlot?: React.ReactNode  // 저장 버튼
  titleSlot?: React.ReactNode  // 제목 옆 아이콘 (ⓘ 등)
}

export default function Navbar({ rightSlot, titleSlot }: Props) {
  const pathname = usePathname()
  const page = PAGE_INFO[pathname] ?? PAGE_INFO['/dashboard']

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-2.5">

        {/* 제목 + 우측(저장+로그아웃) */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight truncate">{page.title}</h1>
            {titleSlot}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {rightSlot}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap">
              로그아웃
            </button>
          </div>
        </div>

        {/* 페이지 탭 */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                pathname === l.href
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}>
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </div>

      </div>
    </nav>
  )
}
