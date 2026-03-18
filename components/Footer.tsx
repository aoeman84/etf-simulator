export default function Footer() {
  return (
    <footer className="mt-12 pb-8 px-4 text-center">
      <div className="max-w-6xl mx-auto border-t border-slate-200 pt-6 space-y-1.5">
        <p className="text-sm font-semibold text-slate-600">Designed &amp; Built by <span className="text-blue-600">Chang Bi</span></p>
        <p className="text-xs text-slate-400">Powered by Claude · © 2026</p>
        <p className="text-xs text-slate-400">본 서비스는 투자 참고용이며 투자 권유가 아닙니다. 과거 수익률이 미래 성과를 보장하지 않습니다.</p>
        <p className="text-xs text-slate-300 select-none">v1.65</p>
      </div>
    </footer>
  )
}
