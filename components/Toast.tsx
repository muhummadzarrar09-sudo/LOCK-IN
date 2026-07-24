'use client';
import { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((curr) => curr.filter(t => t.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((curr) => [...curr, { id, message, variant }]);
    setTimeout(() => remove(id), 4500);
  }, [remove]);

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe fallback: no-op toasts (so calls don't crash if used outside provider)
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

function ToastViewport({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:max-w-sm z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-300" strokeWidth={2.2} />,
    error: <XCircle className="w-4 h-4 text-red-300" strokeWidth={2.2} />,
    info: <Info className="w-4 h-4 text-amber-300" strokeWidth={2.2} />,
  };

  const styleMap = {
    success: 'bg-[#121212] border-emerald-700/40',
    error: 'bg-[#121212] border-red-700/40',
    info: 'bg-[#121212] border-amber-700/40',
  };

  return (
    <div
      className={`pointer-events-auto rounded-xl border shadow-2xl shadow-black/50 px-4 py-3 flex items-start gap-3 ${styleMap[toast.variant]} toast-slide-in`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 220ms ease, transform 220ms ease',
      }}
      role="status"
    >
      <div className="shrink-0 mt-0.5">{iconMap[toast.variant]}</div>
      <p className="text-sm text-neutral-100 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={onRemove}
        className="shrink-0 -mr-1 -mt-1 p-1 text-neutral-500 hover:text-neutral-300"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
