'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share2, X, Loader2, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { useToast } from './Toast';
import { getAchievement, AchievementCode } from '@/lib/achievements';

type Props = {
  open: boolean;
  onClose: () => void;
  achievementCode?: AchievementCode | null;
  username?: string | null;
  streak?: number;
  bestStreak?: number;
  totalCheckIns?: number;
  cohortDay?: number;
};

type Format = 'achievement' | 'streak';

const W = 1200;
const H = 1200;

/**
 * Share-card generator. Renders a 1200x1200 PNG to an offscreen canvas
 * using the user's stats, then offers Download / Copy / Share.
 *
 * Two formats:
 * - 'achievement' (default): big badge with the user's name + the badge title
 * - 'streak': streak number with sub-stats (best, total check-ins, day)
 *
 * All rendering is client-side Canvas API. No new APIs.
 */
export function ShareCardModal({
  open,
  onClose,
  achievementCode,
  username,
  streak = 0,
  bestStreak = 0,
  totalCheckIns = 0,
  cohortDay,
}: Props) {
  const toast = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<Format>('achievement');
  const [rendering, setRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (open) {
      setFormat(achievementCode ? 'achievement' : 'streak');
      setCopied(false);
      setDownloaded(false);
    }
  }, [open, achievementCode]);

  useEffect(() => {
    if (!open) return;
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, format, achievementCode, username, streak, bestStreak, totalCheckIns, cohortDay]);

  const render = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRendering(true);
    try {
      if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
        try { await (document as any).fonts.ready; } catch { /* ignore */ }
      }
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0D0D0D');
      bg.addColorStop(0.5, '#161109');
      bg.addColorStop(1, '#0D0D0D');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      const radial = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
      radial.addColorStop(0, 'rgba(251, 191, 36, 0.10)');
      radial.addColorStop(0.5, 'rgba(251, 191, 36, 0.04)');
      radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, W, H);

      if (format === 'achievement' && achievementCode) {
        renderAchievementCard(ctx, achievementCode, username);
      } else {
        renderStreakCard(ctx, username, streak, bestStreak, totalCheckIns, cohortDay);
      }
    } catch (e) {
      console.error('share card render failed', e);
    } finally {
      setRendering(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Could not generate image.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ts = new Date().toISOString().slice(0, 10);
        a.download = format === 'achievement' && achievementCode
          ? `discipline-${achievementCode}-${ts}.png`
          : `discipline-streak-${streak}d-${ts}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDownloaded(true);
        toast.success('Image downloaded');
        setTimeout(() => setDownloaded(false), 2200);
      }, 'image/png', 0.95);
    } catch (e) {
      toast.error('Download failed. Try the Copy button instead.');
    }
  };

  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
        toast.info('Copy not supported here. Use Download.');
        return;
      }
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) {
        toast.error('Could not copy image.');
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = new (ClipboardItem as any)({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      setCopied(true);
      toast.success('Image copied to clipboard');
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      toast.info('Copy blocked. Use Download instead.');
    }
  };

  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof navigator === 'undefined' || typeof (navigator as any).share !== 'function') {
      handleDownload();
      return;
    }
    try {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) {
        toast.error('Could not share.');
        return;
      }
      const file = new File([blob], 'discipline.png', { type: 'image/png' });
      const nav: any = navigator as any;
      const text = format === 'achievement' && achievementCode
        ? `I just unlocked ${getAchievement(achievementCode)?.title} on Discipline.`
        : `${streak}-day streak on Discipline. 30 days. The contract.`;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text });
      } else {
        await nav.share({ text });
      }
    } catch {
      // user cancelled
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/85 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-card-title"
    >
      <div
        className="max-w-md w-full rounded-2xl border border-amber-700/40 bg-[#121212] p-5 shadow-2xl fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-amber-300" />
            <h2 id="share-card-title" className="text-sm font-extrabold tracking-tight text-white">
              Share your card
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 hover:text-white"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 mb-3 p-1 rounded-lg bg-neutral-900/60 border border-neutral-800">
          <button
            onClick={() => setFormat('achievement')}
            disabled={!achievementCode}
            className={`flex-1 h-8 px-2 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
              format === 'achievement' ? 'bg-amber-400 text-black' : 'text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400'
            }`}
          >
            Badge
          </button>
          <button
            onClick={() => setFormat('streak')}
            className={`flex-1 h-8 px-2 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
              format === 'streak' ? 'bg-amber-400 text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Streak
          </button>
        </div>

        <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-neutral-800 bg-[#0D0D0D] mb-4">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-amber-300 animate-spin" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleDownload}
            disabled={rendering}
            className="h-10 px-2 rounded-lg bg-amber-400 text-black font-extrabold text-xs hover:bg-amber-300 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {downloaded ? 'Saved' : 'Download'}
          </button>
          <button
            onClick={handleCopy}
            disabled={rendering}
            className="h-10 px-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 font-bold text-xs hover:border-neutral-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleShare}
            disabled={rendering}
            className="h-10 px-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 font-bold text-xs hover:border-neutral-600 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>

        <p className="text-[10px] text-neutral-500 text-center mt-3 leading-relaxed">
          1200x1200 PNG. Works on Twitter, Instagram, LinkedIn.
        </p>
      </div>
    </div>
  );
}

// Canvas rendering helpers

function renderAchievementCard(
  ctx: CanvasRenderingContext2D,
  code: AchievementCode,
  username?: string | null
) {
  const meta = getAchievement(code);
  if (!meta) return;

  ctx.font = '600 22px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('BADGE UNLOCKED', W / 2, 140);

  ctx.font = '700 36px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(username ? '@' + username : '@member', W / 2, 180);

  const cx = W / 2;
  const cy = H / 2 - 60;
  const r = 180;

  // Outer disc
  ctx.beginPath();
  ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
  ctx.fillStyle = meta.bgColor;
  ctx.fill();

  // Inner solid disc
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, '#1a1308');
  grad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = meta.ringColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Glow
  ctx.shadowColor = meta.ringColor;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = meta.ringColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Tier symbol
  const tierSymbol = meta.tier === 'legendary' ? '\u2605' : meta.tier === 'rare' ? '\u25C6' : '\u25CF';
  ctx.font = '900 200px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = meta.ringColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tierSymbol, cx, cy);

  // Title
  ctx.font = '900 64px ui-serif, Georgia, serif';
  ctx.fillStyle = meta.ringColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(meta.title, W / 2, cy + r + 60);

  // Blurb
  ctx.font = '500 28px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  wrapText(ctx, meta.blurb, W / 2, cy + r + 160, W - 200, 36);

  // Trigger
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillText(meta.trigger.toUpperCase(), W / 2, H - 160);

  // Footer
  ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.fillText('DISCIPLINE  \u00B7  30-DAY EXECUTION COHORT', W / 2, H - 110);
}

function renderStreakCard(
  ctx: CanvasRenderingContext2D,
  username?: string | null,
  streak = 0,
  bestStreak = 0,
  totalCheckIns = 0,
  cohortDay?: number
) {
  ctx.font = '600 22px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.7)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('CURRENT STREAK', W / 2, 140);

  ctx.font = '700 36px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(username ? '@' + username : '@member', W / 2, 180);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const grad = ctx.createLinearGradient(0, H / 2 - 200, 0, H / 2 + 200);
  grad.addColorStop(0, '#fcd34d');
  grad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = grad;
  ctx.font = '900 380px ui-serif, Georgia, serif';
  ctx.fillText(String(streak), W / 2, H / 2 - 40);

  ctx.font = '800 60px ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('DAYS', W / 2, H / 2 + 200);

  const subY = H / 2 + 320;
  const colW = 320;
  const startX = (W - colW * 3) / 2;
  const stats: { label: string; value: string }[] = [
    { label: 'BEST', value: bestStreak + 'd' },
    { label: 'CHECK-INS', value: String(totalCheckIns) },
    { label: 'COHORT DAY', value: cohortDay ? 'Day ' + cohortDay : '\u2014' },
  ];
  stats.forEach((s, i) => {
    const x = startX + colW * i + colW / 2;
    ctx.font = '900 56px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.fillText(s.value, x, subY);
    ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(s.label, x, subY + 70);
  });

  ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('DISCIPLINE  \u00B7  30-DAY EXECUTION COHORT', W / 2, H - 110);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
}
