'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ReactNode } from 'react'

interface NavbarProps {
  titleSlot?: ReactNode
}

const TABS = [
  { href: '/dashboard', label: 'Sim' },
  { href: '/sim2',      label: 'Sim²' },
  { href: '/simk',      label: 'Sim K' },
  { href: '/compare',   label: 'ETF 비교' },
  { href: '/backtest',  label: '백테스트' },
  { href: '/portfolio', label: 'My PF' },
]

export default function Navbar({ titleSlot }: NavbarProps) {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-13 gap-3" style={{ height: '52px' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="font-black tracking-tight whitespace-nowrap select-none"
              style={{
                fontSize: '22px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              ETF Sim
            </span>
            {titleSlot && <div className="flex-shrink-0">{titleSlot}</div>}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-all whitespace-nowrap flex-shrink-0"
          >
            로그아웃
          </button>
        </div>

        <div className="flex gap-0.5 -mb-px overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            const active = pathname === tab.href || pathname?.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative px-2 py-2 text-xs sm:px-3 sm:py-2.5 sm:text-sm font-medium transition-all whitespace-nowrap border-b-2 flex-shrink-0 ${
                  active
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700 border-transparent'
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
