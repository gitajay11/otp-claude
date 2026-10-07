import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';

/**
 * Toast notifications.
 *
 *   const toast = useToast();
 *   toast.success('Code sent', 'Check your inbox');
 *   toast.error('Oops', 'Something failed', { action: { label: 'Retry', onClick } });
 */

const ToastContext = createContext(null);

const STYLES = {
  success: { accent: 'bg-neon-green', ring: 'border-neon-green/30', icon: '✓', iconClass: 'text-neon-green' },
  error: { accent: 'bg-neon-red', ring: 'border-neon-red/30', icon: '✕', iconClass: 'text-neon-red' },
  info: { accent: 'bg-neon-cyan', ring: 'border-neon-cyan/30', icon: 'i', iconClass: 'text-neon-cyan' },
};

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (type, title, message, { action, duration = DEFAULT_DURATION } = {}) => {
      const id = crypto.randomUUID();
      setToasts((list) => [...list.slice(-3), { id, type, title, message, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (title, message, opts) => show('success', title, message, opts),
      error: (title, message, opts) => show('error', title, message, opts),
      info: (title, message, opts) => show('info', title, message, opts),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)}
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-stretch gap-3 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[380px]"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              role={t.type === 'error' ? 'alert' : 'status'}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className={cn(
                'pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border bg-void-2/90 p-4 pl-5 shadow-2xl backdrop-blur-xl',
                s.ring,
              )}
            >
              <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', s.accent)} />
              <span
                aria-hidden="true"
                className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current font-mono text-[11px] font-bold', s.iconClass)}
              >
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] font-semibold text-slate-50">{t.title}</p>
                {t.message && <p className="mt-0.5 text-[13px] leading-snug text-slate-300">{t.message}</p>}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action.onClick();
                      onDismiss(t.id);
                    }}
                    className="mt-2 font-mono text-xs font-semibold text-neon-cyan hover:underline underline-offset-4"
                  >
                    {t.action.label} →
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                aria-label="Dismiss notification"
                className="-m-1 grid size-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
              >
                ✕
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
