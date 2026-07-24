'use client';
import { useEffect, useState } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';

type Platform = 'ios' | 'android-chrome' | 'android-other' | 'desktop-chrome' | 'unknown';

const STORAGE_KEY = 'discipline.installPrompt.dismissed.v1';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome|Chromium/.test(ua) && !/Edg|OPR/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;

  if (isStandalone) return 'unknown';
  if (isIOS) return 'ios';
  if (isAndroid && isChrome) return 'android-chrome';
  if (isAndroid) return 'android-other';
  if (isChrome) return 'desktop-chrome';
  return 'unknown';
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    if (p === 'unknown') return;
    // Already dismissed recently?
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (last) {
        const days = (Date.now() - Number(last)) / (1000 * 60 * 60 * 24);
        if (days < 7) return; // don't re-prompt for 7 days
      }
    } catch {}
    setPlatform(p);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // iOS doesn't fire beforeinstallprompt — show after a small delay if iOS + not standalone
  useEffect(() => {
    if (platform !== 'ios') return;
    if (visible) return;
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, [platform, visible]);

  // Show Android-chrome prompt if beforeinstallprompt fired
  useEffect(() => {
    if (platform === 'android-chrome' && deferredPrompt) setVisible(true);
  }, [platform, deferredPrompt]);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    }
    setDeferredPrompt(null);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install Discipline"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[90] fade-in-up"
    >
      <div className="rounded-2xl border border-amber-700/40 bg-[#121212]/95 backdrop-blur-xl p-4 shadow-2xl shadow-amber-500/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Download className="w-5 h-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-white">Install Discipline</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed mt-0.5">
              {platform === 'ios' ? 'Add to your home screen for the full experience.' : 'Install for one-tap access and offline reading.'}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="w-7 h-7 shrink-0 rounded-md hover:bg-neutral-800 flex items-center justify-center -mr-1 -mt-1"
            aria-label="Dismiss install prompt"
          >
            <X className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>

        {platform === 'ios' ? (
          <div className="mt-3 pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 space-y-1.5">
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 inline-flex items-center justify-center rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold">1</span>
              Tap the <Share className="w-3 h-3 inline mx-0.5" /> Share button below
            </p>
            <p className="flex items-center gap-2">
              <span className="w-4 h-4 inline-flex items-center justify-center rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold">2</span>
              Select <Plus className="w-3 h-3 inline mx-0.5" /> Add to Home Screen
            </p>
          </div>
        ) : (
          <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center gap-2">
            <button
              onClick={install}
              className="flex-1 h-9 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 transition-colors"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="h-9 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-xs hover:border-neutral-600 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
