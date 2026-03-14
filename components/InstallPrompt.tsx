'use client'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Detect iOS (Safari doesn't support beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    // Check if user already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) return

    if (ios) {
      // On iOS show manual instructions after 3 seconds
      setTimeout(() => setShow(true), 3000)
    } else {
      // Android/Chrome/Mac — listen for the install prompt
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
        setShow(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem('pwa-install-dismissed', '1')
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setShow(false)
  }

  if (!show || isInstalled) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80">
      <div className="card p-4 shadow-lg border border-blue-100">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📲</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm mb-1">앱으로 설치하기</div>
            {isIOS ? (
              <p className="text-xs text-slate-500 leading-relaxed">
                Safari 하단의 <strong>공유 버튼</strong> →{' '}
                <strong>"홈 화면에 추가"</strong> 를 탭하세요
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                앱스토어 없이 홈 화면에 설치해서 네이티브 앱처럼 사용하세요
              </p>
            )}
          </div>
        </div>

        {!isIOS && (
          <div className="flex gap-2 mt-3">
            <button onClick={install} className="btn-primary text-sm py-1.5 flex-1">
              설치하기
            </button>
            <button onClick={dismiss} className="btn-ghost text-sm py-1.5">
              나중에
            </button>
          </div>
        )}

        {isIOS && (
          <button onClick={dismiss}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600 w-full text-right">
            닫기
          </button>
        )}
      </div>
    </div>
  )
}
