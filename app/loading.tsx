export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '120ms' }} />
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '240ms' }} />
      </div>
    </main>
  );
}
