import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import Spinner from './Spinner';

const VARIANTS = {
  primary: cn(
    'w-full h-12 rounded-xl px-6 font-mono text-sm font-bold uppercase tracking-[0.18em] text-void',
    'bg-gradient-to-r from-neon-cyan via-[#5ad1ff] to-neon-violet bg-[length:200%_100%] bg-left',
    'shadow-[0_0_24px_-6px_rgb(0_240_255/0.65)]',
    'hover:bg-right hover:shadow-[0_0_36px_-4px_rgb(0_240_255/0.85),0_0_60px_-12px_rgb(139_92_246/0.8)]',
    'transition-[background-position,box-shadow] duration-500',
  ),
  ghost: cn(
    'h-11 rounded-xl border border-white/10 bg-white/[0.03] px-5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-slate-200',
    'hover:border-neon-cyan/50 hover:text-neon-cyan hover:shadow-[0_0_24px_-8px_rgb(0_240_255/0.7)] transition',
  ),
  link: 'h-auto p-0 font-mono text-xs font-semibold tracking-wide text-neon-cyan hover:text-glow-cyan hover:underline underline-offset-4',
};

/**
 * Animated button: hover glow, press scale, inline loading spinner.
 *
 * @param {'primary'|'ghost'|'link'} [variant]
 * @param {boolean} [loading]       shows a spinner and disables the button
 * @param {string}  [loadingText]   label shown while loading
 */
export default function Button({
  children,
  variant = 'primary',
  loading = false,
  loadingText,
  disabled,
  className,
  type = 'button',
  ...props
}) {
  const inactive = disabled || loading;
  return (
    <motion.button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      whileHover={inactive || variant === 'link' ? undefined : { y: -1 }}
      whileTap={inactive ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {/* Sheen sweep on hover */}
      {variant === 'primary' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 blur-sm transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100 group-disabled:hidden"
        />
      )}
      {loading && <Spinner />}
      <span className="relative">{loading && loadingText ? loadingText : children}</span>
    </motion.button>
  );
}
