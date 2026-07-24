import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; onClick: () => void };
};

export default function EmptyState({ icon: Icon, title, description, primaryAction, secondaryAction }: Props) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#121212]/60 p-8 md:p-10 text-center fade-in-up">
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-700/30 mx-auto mb-4 flex items-center justify-center">
        <Icon className="w-5 h-5 text-amber-300" strokeWidth={2.2} />
      </div>
      <h3 className="text-base font-extrabold text-white mb-2">{title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed max-w-sm mx-auto mb-6">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="flex items-center justify-center gap-2">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="h-10 px-4 rounded-xl bg-amber-400 text-black font-extrabold text-sm hover:bg-amber-300 transition-colors inline-flex items-center gap-2"
            >
              {primaryAction.label}
            </Link>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="h-10 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold text-sm hover:border-neutral-600 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
