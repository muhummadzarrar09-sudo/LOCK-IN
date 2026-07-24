import { Flame } from 'lucide-react';

type Props = {
  streak: number;
  best?: number;
  size?: 'sm' | 'md' | 'lg';
  showBest?: boolean;
};

export default function StreakChip({ streak, best, size = 'md', showBest = false }: Props) {
  // Hide streak if user is just starting (0–1). Don't shame newcomers.
  if (streak <= 1 && !showBest) {
    return (
      <div className="text-right">
        <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Streak</div>
        <div className="text-sm font-semibold text-neutral-400">Just starting</div>
      </div>
    );
  }

  const wrapper =
    size === 'lg'
      ? 'px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30'
      : size === 'sm'
      ? 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20'
      : 'inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20';
  const num =
    size === 'lg' ? 'text-2xl font-black text-amber-200' : size === 'sm' ? 'text-xs font-extrabold text-amber-200' : 'text-sm font-extrabold text-amber-200';
  const label =
    size === 'lg' ? 'text-[10px] uppercase tracking-[0.2em] text-amber-300/80' : 'hidden';
  const icon =
    size === 'lg' ? 'w-5 h-5 text-amber-300' : size === 'sm' ? 'w-3 h-3 text-amber-300' : 'w-3.5 h-3.5 text-amber-300';

  return (
    <div className={size === 'lg' ? wrapper : 'inline-flex flex-col items-end gap-0.5'}>
      {size === 'lg' ? (
        <div className="flex items-center gap-2">
          <Flame className={icon} />
          <span className={num}>{streak}</span>
          <span className="text-[10px] text-amber-300/70 font-bold ml-1">days</span>
        </div>
      ) : (
        <span className={wrapper}>
          <Flame className={icon} />
          <span className={num}>{streak}</span>
        </span>
      )}
      {size === 'lg' && <div className={label}>Current Streak</div>}
      {showBest && best !== undefined && best > 0 && (
        <div className="text-[10px] text-neutral-500 mt-0.5">Best: {best}</div>
      )}
    </div>
  );
}
