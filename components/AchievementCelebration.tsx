'use client';

import { useEffect, useState, useRef } from 'react';
import { Crown, Sparkles, X, Award, Share2, Copy, Check } from 'lucide-react';
import { getAchievement } from '@/lib/achievements';
import { useToast } from './Toast';

type Props = {
  code: string | null;
  onClose: () => void;
};

// Full-screen celebration when a new badge is unlocked.
// Auto-dismisses after 5s but stays interactive.
export function AchievementCelebration({ code, onClose }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastShownRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code || lastShownRef.current === code) return;
    lastShownRef.current = code;
    setOpen(true);
    setCopied(false);
    // Best-effort: also fire a real OS notification so the user sees it
    // even if they have the tab backgrounded.
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const meta = getAchievement(code);
        if (meta) {
          new Notification(`${meta.title} unlocked`, {
            body: meta.blurb,
            tag: 'achievement',
          });
        }
      } catch { /* notifications may be blocked */ }
    }
    const t = setTimeout(() => {
      setOpen(false);
      setTimeout(onClose, 220);
    }, 8000); // a bit longer now that we have a share button
    return () => clearTimeout(t);
  }, [code, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setTimeout(onClose, 220);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleShare = async () => {
    const meta = getAchievement(code!);
    if (!meta) return;
    const text = `I just unlocked "${meta.title}" on Discipline. ${meta.blurb}`;
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://lockin.app';
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    try {
      if (nav && typeof nav.share === 'function') {
        await nav.share({ title: `${meta.title} unlocked`, text, url });
      } else if (nav && nav.clipboard) {
        await nav.clipboard.writeText(`${text} ${url}`);
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2200);
      }
    } catch { /* user cancelled */ }
  };

  if (!code) return null;
  const meta = getAchievement(code);
  if (!meta) return null;

  const Icon = meta.tier === 'legendary' ? Crown : meta.tier === 'rare' ? Sparkles : Award;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-5"
      style={{
        background: open ? 'rgba(0, 0, 0, 0.85)' : 'rgba(0, 0, 0, 0)',
        backdropFilter: open ? 'blur(8px)' : 'blur(0px)',
        transition: 'background 220ms ease, backdrop-filter 220ms ease',
      }}
      onClick={() => { setOpen(false); setTimeout(onClose, 220); }}
      role="dialog"
      aria-modal="true"
      aria-label="Achievement unlocked"
    >
      <div
        className="max-w-sm w-full rounded-2xl border bg-[#121212] p-7 text-center relative overflow-hidden"
        style={{
          borderColor: meta.ringColor,
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
          transition: 'opacity 220ms ease, transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          boxShadow: `0 0 60px -10px ${meta.ringColor}55, 0 30px 80px -20px rgba(0,0,0,0.8)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative radial glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${meta.ringColor}33 0%, transparent 60%)`,
            filter: 'blur(20px)',
          }}
        />

        <button
          onClick={() => { setOpen(false); setTimeout(onClose, 220); }}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 font-extrabold mb-5">
            {meta.tier === 'legendary' ? 'Legendary Unlocked' : meta.tier === 'rare' ? 'Rare Unlocked' : 'Achievement Unlocked'}
          </p>

          {/* Animated badge ring */}
          <div className="relative w-24 h-24 mx-auto mb-5">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: meta.bgColor,
                border: `2px solid ${meta.ringColor}`,
                boxShadow: `0 0 0 8px ${meta.ringColor}1a, 0 0 30px ${meta.ringColor}66`,
                animation: 'ach-pop 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className="w-10 h-10" style={{ color: meta.ringColor }} strokeWidth={2.2} />
            </div>
          </div>

          <h2
            className="text-2xl font-black tracking-tighter mb-2"
            style={{ color: meta.ringColor }}
          >
            {meta.title}
          </h2>
          <p className="text-sm text-neutral-300 leading-relaxed mb-5">
            {meta.blurb}
          </p>

          <button
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 transition-colors mb-3"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied' : 'Share this badge'}
          </button>

          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-bold border-t border-neutral-900 pt-3">
            {meta.trigger}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes ach-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
