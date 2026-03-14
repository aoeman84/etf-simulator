'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

export default function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const links = [
    { href: '/dashboard', label: '시뮬레이터', icon: '📊' },
    { href: '/compare',   label: 'ETF 비교',   icon: '📉' },
    { href: '/portfolio', label: '포트폴리오', icon: '💼' },
  ]

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      {/* 데스크탑 */}
      <div className="hidden md:flex max-w-6xl mx-auto px-4 h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-blue-600 text-lg">📈 ETF Sim</Link>
          <div className="flex gap-1">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  pathname === l.href
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {session?.user && (
            <span className="text-sm text-slate-400 truncate max-w-40">
              {session.user.name ?? session.user.email}
            </span>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            로그아웃
          </button>
        </div>
      </div>

      {/* 모바일 — 탭 + 로그아웃만 */}
      <div className="flex md:hidden items-center justify-between px-2 h-12">
        <div className="flex gap-0.5 flex-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`flex-1 flex flex-col items-center justify-center py-1 rounded-lg text-xs font-medium transition-colors ${
                pathname === l.href
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}>
              <span className="text-base leading-none mb-0.5">{l.icon}</span>
              <span style={{fontSize: '10px'}}>{l.label}</span>
            </Link>
          ))}
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })}
          className="ml-2 text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-100 whitespace-nowrap transition-colors flex-shrink-0">
          로그아웃
        </button>
      </div>
    </nav>
  )
}
