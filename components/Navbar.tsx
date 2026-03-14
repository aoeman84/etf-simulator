'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ReactNode } from 'react'

interface NavbarProps {
  titleSlot?: ReactNode
}

const TABS = [
  {
    href: '/dashboard',
    label: 'Sim',
    desc: '적립식 투자 시뮬레이터 · 세금/시나리오 설정',
    tooltip: 'ETF 적립식 투자 시뮬레이션 · 세금·시나리오·DRIP 설정 포함',
  },
  {
    href: '/sim2',
    label: 'Sim²',
    desc: '목표 월배당 역산 계산기 · 세금 반영',
    tooltip: '목표 월 배당금을 설정하면 필요한 월 투자금을 역산',
  },
  {
    href: '/compare',
    label: 'ETF 비교',
    desc: 'ETF별 성과 비교 · 시나리오 적용',
    tooltip: '여러 ETF의 장기 성과를 나란히 비교',
  },
  {
    href: '/portfolio',
    label: 'My PF',
    desc: '저장된 포트폴리오 · 실제 매수 기록',
    tooltip: '시뮬레이션 저장 목록 및 실제 매수 내역 관리',
  },
]

export default function Navbar({ titleSlot }: NavbarProps) {
  const pathname = usePathname()

  const activeTab = TABS.find(tab =>
    pathname === tab.href || pathname?.startsWith(tab.href + '/')
  )

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4">
        {/* 상단 바 */}
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

        {/* 탭 */}
        <div className="flex gap-0.5 -mb-px">
          {TABS.map(tab => {
            const active = pathname === tab.href || pathname?.startsWith(tab.href + '/')
            return (
              <Link
                key={tab.href}
                href={tab.href}
                title={tab.tooltip}  // PC 호버 툴팁
                className={`relative px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
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

        {/* 현재 탭 설명 한 줄 */}
        {activeTab && (
          <div className="py-1.5 border-b border-slate-100">
            <p className="text-xs text-slate-400 truncate">{activeTab.desc}</p>
          </div>
        )}
      </div>
    </nav>
  )
}
