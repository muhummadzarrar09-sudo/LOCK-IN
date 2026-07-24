'use client';
import { useEffect, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';

const HINTS: { id: string; key: string; title: string; body: string; selector: string; position?: 'top' | 'bottom' }[] = [
  {
    id: 'streak',
    key: 'streak',
    title: 'Your streak lives here',
    body: 'Check in to your time blocks daily to keep it alive. Miss a day, it breaks. Simple, brutal, effective.',
    selector: '[data-onboarding="streak"]',
    position: 'bottom',
  },
  {
    id: 'now',
    key: 'now',
    title: 'Always know what to do next',
    body: 'The big card at the top is the answer to "what do I do right now?". Tap it to check in when you finish.',
    selector: '[data-onboarding="now"]',
    position: 'bottom',
  },
  {
    id: 'blocks',
    key: 'blocks',
    title: 'The full day at a glance',
    body: 'Your 6 time blocks for today. "Live" is the current one, "Next" is upcoming, "Missed" means the time passed.',
    selector: '[data-onboarding="blocks"]',
    position: 'top',
  },
];

const STORAGE_KEY = 'discipline.onboardingHints.dismissed.v1';

export function OnboardingHint() {
  const [activeHint, setActiveHint] = useState<typeof HINTS[number] | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let dismissed: string[] = [];
    try { dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}

    // Find the first non-dismissed hint whose target exists
    for (const hint of HINTS) {
      if (dismissed.includes(hint.id)) continue;
      const el = document.querySelector(hint.selector);
      if (!el) continue;
      setActiveHint(hint);
      const rect = el.getBoundingClientRect();
      const isBelow = (hint.position || 'bottom') === 'bottom';
      setPosition({
        top: isBelow ? rect.bottom + 8 : rect.top - 8,
        left: Math.max(8, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 160)),
        placement: isBelow ? 'top' : 'bottom',
      });
      break;
    }
  }, []);

  const dismiss = (id: string, all = false) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || '[]';
      const arr = JSON.parse(raw) as string[];
      if (all) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(HINTS.map((h) => h.id)));
      } else if (!arr.includes(id)) {
        arr.push(id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      }
    } catch {}
    setActiveHint(null);
  };

  if (!activeHint || !position) return null;

  return (
    <div
      className="fixed z-[70] w-[320px] fade-in-up"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-live="polite"
    >
      {position.placement === 'top' && (
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-amber-400 border-l border-t border-amber-300" />
      )}
      <div className="rounded-xl bg-amber-400 text-black p-4 shadow-2xl shadow-amber-500/30 relative">
        <button
          onClick={() => dismiss(activeHint.id)}
          className="absolute top-2 right-2 w-6 h-6 rounded-md hover:bg-black/10 flex items-center justify-center"
          aria-label="Dismiss hint"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <p className="text-[10px] uppercase tracking-[0.2em] font-extrabold opacity-70 mb-1">Tip</p>
        <p className="text-sm font-extrabold leading-snug mb-1.5 pr-5">{activeHint.title}</p>
        <p className="text-xs leading-relaxed opacity-90 mb-3">{activeHint.body}</p>
        <div className="flex items-center justify-between">
          <button
            onClick={() => dismiss(activeHint.id, true)}
            className="text-[10px] font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
          >
            Skip all tips
          </button>
          <button
            onClick={() => dismiss(activeHint.id)}
            className="inline-flex items-center gap-1 text-xs font-extrabold"
          >
            Got it <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
      {position.placement === 'bottom' && (
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-amber-400 border-r border-b border-amber-300" />
      )}
    </div>
  );
}
