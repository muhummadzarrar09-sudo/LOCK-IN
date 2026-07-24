'use client';

import { Award, Crown, Sparkles } from 'lucide-react';
import { ACHIEVEMENTS, AchievementMeta, getAchievement } from '@/lib/achievements';

type Props = {
  code: string;
  size?: 'sm' | 'md' | 'lg';
  // When true (default), the badge is interactive and announces its blurb via title.
  showTitle?: boolean;
};

const ICON_MAP = {
  common: Award,
  rare: Sparkles,
  legendary: Crown,
};

const SIZE_MAP = {
  sm: { box: 'w-9 h-9', icon: 'w-4 h-4', ring: 1.5 },
  md: { box: 'w-12 h-12', icon: 'w-5 h-5', ring: 2 },
  lg: { box: 'w-16 h-16', icon: 'w-7 h-7', ring: 2.5 },
};

export function AchievementBadge({ code, size = 'md', showTitle = true }: Props) {
  const meta = getAchievement(code);
  if (!meta) return null;
  const Icon = ICON_MAP[meta.tier];
  const sz = SIZE_MAP[size];

  return (
    <div
      className="inline-flex flex-col items-center text-center"
      title={showTitle ? `${meta.title} — ${meta.blurb}` : undefined}
      aria-label={showTitle ? `${meta.title}. ${meta.blurb}` : undefined}
    >
      <div
        className={`${sz.box} rounded-full flex items-center justify-center border transition-transform hover:scale-105`}
        style={{
          borderColor: meta.ringColor,
          background: meta.bgColor,
          boxShadow: `0 0 0 1px ${meta.ringColor}33 inset, 0 6px 18px -8px ${meta.ringColor}55`,
        }}
      >
        <Icon
          className={sz.icon}
          style={{ color: meta.ringColor }}
          strokeWidth={sz.ring}
        />
      </div>
      {size !== 'sm' && (
        <span className="mt-1.5 text-[9px] font-extrabold uppercase tracking-wider text-neutral-400 max-w-[64px] leading-tight">
          {meta.title}
        </span>
      )}
    </div>
  );
}

type GridProps = {
  codes: string[];
  size?: 'sm' | 'md' | 'lg';
  emptyMessage?: string;
};

export function AchievementGrid({ codes, size = 'sm', emptyMessage = 'No badges yet — first one unlocks at a 3-day streak.' }: GridProps) {
  if (codes.length === 0) {
    return <p className="text-xs text-neutral-500">{emptyMessage}</p>;
  }
  // De-dup and order by canonical list order (3, 7, 14, 30, 100)
  const seen = new Set<string>();
  const ordered: AchievementMeta[] = [];
  for (const m of Object.values(ACHIEVEMENTS)) {
    if (codes.includes(m.code) && !seen.has(m.code)) {
      seen.add(m.code);
      ordered.push(m);
    }
  }
  return (
    <div className="flex flex-wrap gap-3">
      {ordered.map((m) => (
        <AchievementBadge key={m.code} code={m.code} size={size} />
      ))}
    </div>
  );
}
