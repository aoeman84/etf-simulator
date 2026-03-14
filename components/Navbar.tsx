'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

export default function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const links = [
    { href: '/dashboard', label: '시뮬레이터' },
    { href: '/compare', label: 'ETF 비교' },
    { href: '/portfolio', label: '내 포트폴리오' },
  ]

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-bold text-blue-600 text-lg">📈 ETF Sim</Link>
          <div className="hidden md:flex gap-1">
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
            <span className="text-sm text-slate-500 hidden md:block">
              {session.user.name ?? session.user.email}
            </span>
          )}
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-sm btn-ghost py-1.5">
            로그아웃
          </button>
        </div>
      </div>
    </nav>
  )
}
