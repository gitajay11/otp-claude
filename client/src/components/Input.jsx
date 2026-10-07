import { forwardRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';

/**
 * Text input with a floating label, glowing focus ring, animated gradient
 * underline, and an animated inline error / hint message.
 *
 * Uses the `placeholder=" "` + :placeholder-shown trick so the label floats
 * with pure CSS (works with autofill, no JS state needed).
 */
const Input = forwardRef(function Input({ id, label, error, hint, className, ...props }, ref) {
  const messageId = `${id}-msg`;
  const hasError = Boolean(error);

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'relative rounded-xl border bg-white/[0.035] transition-[border-color,box-shadow] duration-200',
          hasError
            ? 'border-neon-red/70 shadow-[0_0_0_3px_rgb(255_77_115/0.12),0_0_22px_-8px_rgb(255_77_115/0.7)]'
            : 'border-white/10 hover:border-white/20 focus-within:border-neon-cyan/70 focus-within:shadow-[0_0_0_3px_rgb(0_240_255/0.12),0_0_26px_-6px_rgb(0_240_255/0.55)]',
        )}
      >
        <input
          ref={ref}
          id={id}
          placeholder=" "
          aria-invalid={hasError || undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className="peer block h-14 w-full rounded-xl bg-transparent px-4 pb-2 pt-6 text-[15px] text-slate-50 caret-neon-cyan outline-none placeholder:text-transparent"
          {...props}
        />
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute left-4 top-2 origin-left font-mono text-[11px] uppercase tracking-[0.14em] transition-all duration-200',
            'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:font-sans peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal',
            'peer-focus:top-2 peer-focus:translate-y-0 peer-focus:font-mono peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-[0.14em]',
            hasError ? 'text-neon-red' : 'text-slate-400 peer-focus:text-neon-cyan',
          )}
        >
          {label}
        </label>
        {/* Animated focus underline */}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-4 bottom-0 h-px origin-center scale-x-0 transition-transform duration-300 ease-out peer-focus:scale-x-100',
            hasError
              ? 'bg-neon-red'
              : 'bg-gradient-to-r from-transparent via-neon-cyan to-transparent',
          )}
        />
      </div>

      <AnimatePresence initial={false} mode="wait">
        {hasError ? (
          <motion.p
            key="error"
            id={messageId}
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-1.5 overflow-hidden px-1 pt-1.5 text-[13px] leading-snug text-neon-red"
          >
            <span aria-hidden="true" className="font-mono">!</span>
            <span>{error}</span>
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            id={messageId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-1 pt-1.5 font-mono text-[11px] text-slate-400"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

export default Input;
