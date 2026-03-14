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
  rightSlot?: React.ReactNode // 저장 버튼 등 우측 슬롯
}

export default function Navbar({ rightSlot }: Props) {
  const pathname = usePathname()
  const page = PAGE_INFO[pathname] ?? PAGE_INFO['/dashboard']

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4">
        {/* 상단 로고 + 로그아웃 */}
        <div className="flex items-center justify-between h-11 border-b border-slate-100">
          <Link href="/dashboard" className="font-bold text-blue-600 flex items-center gap-1.5">
            📈 <span>ETF Sim</span>
          </Link>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
            로그아웃
          </button>
        </div>

        {/* 탭 + 제목 + 우측 슬롯 */}
        <div className="py-2.5">
        {/* 제목 + 우측 슬롯 */}
        <div className="flex items-center justify-between mt-0 mb-2">
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">{page.title}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{page.desc}</p>
          </div>
          {rightSlot && <div className="flex-shrink-0 ml-3">{rightSlot}</div>}
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
      </div>
    </nav>
  )
}
