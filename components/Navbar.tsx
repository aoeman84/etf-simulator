'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ReactNode } from 'react'

interface NavbarProps {
  titleSlot?: ReactNode   // 시나리오 버튼 등
  rightSlot?: ReactNode   // 저장 버튼 등
  shareSlot?: ReactNode   // 공유 버튼
}

const TABS = [
  { href: '/dashboard', label: 'Sim' },
  { href: '/sim2',      label: 'Sim²' },
  { href: '/compare',   label: 'ETF 비교' },
  { href: '/portfolio', label: 'My PF' },
]

export default function Navbar({ titleSlot, rightSlot, shareSlot }: NavbarProps) {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      {/* 상단 바 */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-12 gap-2">
          {/* 왼쪽: 타이틀 + 시나리오 버튼 */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-base text-slate-800 whitespace-nowrap tracking-tight">
              ETF Sim
            </span>
            {titleSlot && <div className="flex-shrink-0">{titleSlot}</div>}
          </div>

          {/* 오른쪽: 공유 + 저장 + 로그아웃 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* 공유 아이콘 버튼 */}
            {shareSlot && <div>{shareSlot}</div>}

            {rightSlot && <div>{rightSlot}</div>}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-all whitespace-nowrap"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-0.5 pb-0 -mb-px">
          {TABS.map(tab => {
            const active = pathname === tab.href || pathname?.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
