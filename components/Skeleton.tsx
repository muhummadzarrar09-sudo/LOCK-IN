type Props = {
  className?: string;
  rows?: number;
};

export function Skeleton({ className = 'h-4 w-full' }: Props) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-6 space-y-3">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-800 bg-[#121212]/60 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <Skeleton className="h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
