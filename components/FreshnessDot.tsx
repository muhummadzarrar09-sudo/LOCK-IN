'use client';

type Props = {
  iso: string;
  // Hours after which the dot disappears. Default 24.
  windowHours?: number;
  // Optional className for sizing
  className?: string;
};

/**
 * Tiny pulsing green dot that appears next to a timestamp when the item
 * is fresh (less than `windowHours` old). Pure visual cue.
 */
export function FreshnessDot({ iso, windowHours = 24, className = '' }: Props) {
  if (!iso) return null;
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 0 || ageMs > windowHours * 60 * 60 * 1000) return null;
  return (
    <span
      className={`relative inline-flex h-1.5 w-1.5 shrink-0 ${className}`}
      aria-label="Fresh"
      title="Fresh"
    >
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  );
}
