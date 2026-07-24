import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  size?: 'sm' | 'md';
};

export default function PageHeader({ icon: Icon, title, subtitle, action, size = 'md' }: Props) {
  const iconWrap = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const titleSize = size === 'sm' ? 'text-xl' : 'text-2xl';

  return (
    <div className="flex items-center gap-3 mb-6 md:mb-8">
      <div className={`${iconWrap} rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-400/10 shrink-0`}>
        <Icon className={`${iconSize} text-black`} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className={`${titleSize} font-extrabold tracking-tighter text-white truncate`}>{title}</h1>
        {subtitle && <p className="text-[11px] text-neutral-500 tracking-wide mt-0.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
