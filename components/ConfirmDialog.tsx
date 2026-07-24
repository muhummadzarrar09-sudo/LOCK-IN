'use client';
import { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
      // Lock body scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className="relative max-w-md w-full rounded-2xl border border-neutral-800 bg-[#121212] p-6 shadow-2xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.96)',
          transition: 'opacity 180ms ease, transform 180ms ease',
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          {destructive && (
            <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 id="confirm-title" className="text-base font-extrabold text-white mb-1">{title}</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-md hover:bg-neutral-900 flex items-center justify-center shrink-0 -mt-1 -mr-1" aria-label="Close">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="h-9 px-4 rounded-lg bg-neutral-900 border border-neutral-800 text-sm font-semibold text-neutral-300 hover:border-neutral-600"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`h-9 px-4 rounded-lg text-sm font-extrabold text-black transition-colors ${
              destructive
                ? 'bg-amber-400 hover:bg-amber-300'
                : 'bg-amber-400 hover:bg-amber-300'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
