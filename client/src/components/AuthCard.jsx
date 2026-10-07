import { motion } from 'framer-motion';
import { cn } from '../lib/cn';
import { flipVariants } from '../lib/motion';
import TypingHeading from './TypingHeading';

/** Frosted-glass card shell with a terminal-style header. */
export default function AuthCard({ kicker, title, subtitle, children, footer, className }) {
  return (
    <motion.section
      variants={flipVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ transformPerspective: 1400 }}
      className={cn('glass w-full max-w-[460px] rounded-3xl p-5 sm:p-8', className)}
    >
      <header className="mb-7">
        <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-neon-violet">
          <span className="inline-block size-1.5 rounded-full bg-neon-green shadow-[0_0_8px_var(--color-neon-green)]" />
          {kicker}
        </div>
        <TypingHeading text={title} className="text-xl font-bold leading-snug text-slate-50 sm:text-2xl" />
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p>}
      </header>
      {children}
      {footer && <div className="mt-7 border-t border-white/[0.07] pt-5 text-center text-sm text-slate-400">{footer}</div>}
    </motion.section>
  );
}
