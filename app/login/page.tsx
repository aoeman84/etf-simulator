'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (result?.error) setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    else router.push('/dashboard')
  }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="text-center mb-8">
          <span className="font-black tracking-tight" style={{fontSize:'28px',background:'linear-gradient(135deg,#1d4ed8 0%,#0ea5e9 100%)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>ETF Sim</span>
          <p className="text-slate-500 text-sm mt-2">로그인하여 포트폴리오를 저장하세요</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-sm font-medium text-slate-700 block mb-1">이메일</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></div>
          <div><label className="text-sm font-medium text-slate-700 block mb-1">비밀번호</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required /></div>
          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>{loading?'로그인 중...':'로그인'}</button>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">계정이 없으신가요? <Link href="/register" className="text-blue-600 hover:underline font-medium">회원가입</Link></p>
      </div>
      <div className="mt-8 text-center space-y-1">
        <p className="text-sm font-medium text-slate-500">Designed &amp; Built by <span className="text-blue-600 font-semibold">Chang Bi</span></p>
        <p className="text-xs text-slate-400">Powered by Claude · © 2026</p>
        <p className="text-xs text-slate-400">본 시뮬레이터는 투자 참고용이며 실제 투자 조언이 아닙니다.</p>
        <p className="text-xs text-slate-300 select-none">v1.28</p>
      </div>
    </div>
  )
}
