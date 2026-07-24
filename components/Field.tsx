'use client';
import { useId } from 'react';

type Props = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
};

export default function Field({ label, error, hint, required, children }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
        {label}
        {required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      {children(id, describedBy)}
      {hint && !error && (
        <p id={hintId} className="text-[11px] text-neutral-500 mt-1.5">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1.5">
          <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
          {error}
        </p>
      )}
    </div>
  );
}
