// Centralized achievement metadata. The DB only stores codes; this file
// is the single source of truth for display, copy, and the rare "rare" tag.

export type AchievementCode =
  | 'streak_3'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'streak_100';

export type AchievementMeta = {
  code: AchievementCode;
  title: string;
  // One short sentence shown in toasts and tooltips.
  blurb: string;
  // What triggers it (for copy only — actual logic is in SQL triggers).
  trigger: string;
  // 'common' | 'rare' | 'legendary' — purely visual
  tier: 'common' | 'rare' | 'legendary';
  // Hex for the badge ring (matches the dark/amber palette)
  ringColor: string;
  // Hex for the badge background
  bgColor: string;
};

export const ACHIEVEMENTS: Record<AchievementCode, AchievementMeta> = {
  streak_3: {
    code: 'streak_3',
    title: '3-Day Spark',
    blurb: 'Three consecutive days. The hardest part is starting.',
    trigger: 'Hit a 3-day streak',
    tier: 'common',
    ringColor: '#fcd34d',
    bgColor: 'rgba(252, 211, 77, 0.10)',
  },
  streak_7: {
    code: 'streak_7',
    title: 'Week-Long Wire',
    blurb: 'A full week. Patterns are forming. Identity is shifting.',
    trigger: 'Hit a 7-day streak',
    tier: 'rare',
    ringColor: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.12)',
  },
  streak_14: {
    code: 'streak_14',
    title: 'Fortnight Force',
    blurb: 'Two weeks. The body of evidence is real now.',
    trigger: 'Hit a 14-day streak',
    tier: 'rare',
    ringColor: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.14)',
  },
  streak_30: {
    code: 'streak_30',
    title: 'The Contract',
    blurb: 'Thirty days. The full cohort. The deal is closed.',
    trigger: 'Hit a 30-day streak',
    tier: 'legendary',
    ringColor: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.18)',
  },
  streak_100: {
    code: 'streak_100',
    title: 'Centurion',
    blurb: 'One hundred consecutive days. Rare air.',
    trigger: 'Hit a 100-day streak',
    tier: 'legendary',
    ringColor: '#fde68a',
    bgColor: 'rgba(253, 230, 138, 0.20)',
  },
};

export const ACHIEVEMENT_LIST: AchievementMeta[] = Object.values(ACHIEVEMENTS);

export function getAchievement(code: string | null | undefined): AchievementMeta | null {
  if (!code) return null;
  return (ACHIEVEMENTS as Record<string, AchievementMeta>)[code] ?? null;
}
