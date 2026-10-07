import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../lib/cn';

/**
 * Five single-digit boxes with full keyboard / paste / autofill support and
 * an animated status overlay.
 *
 * status:
 *   'idle'      – editable
 *   'verifying' – neon ring orbits the group
 *   'success'   – ring morphs into a drawn green checkmark, boxes glow green
 *   'error'     – ring morphs into a drawn red ✕, boxes shake and glow red
 *
 * Imperative handle: ref.current.clear(), ref.current.focus(index = 0)
 */
const OtpInput = forwardRef(function OtpInput(
  { length = 5, status = 'idle', disabled = false, onComplete, describedBy, autoFocus = true },
  ref,
) {
  const [digits, setDigits] = useState(() => Array(length).fill(''));
  const inputs = useRef([]);
  const groupRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const locked = disabled || status !== 'idle';

  const focusAt = (index) => {
    const el = inputs.current[Math.max(0, Math.min(length - 1, index))];
    el?.focus();
    el?.select();
  };

  useImperativeHandle(ref, () => ({
    clear: () => setDigits(Array(length).fill('')),
    focus: (index = 0) => requestAnimationFrame(() => focusAt(index)),
  }));

  // Track the group's size so the SVG ring hugs it exactly.
  useLayoutEffect(() => {
    const el = groupRef.current;
    const measure = () => setBox({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Update state and fire onComplete once every box holds a digit. */
  function commit(next) {
    setDigits(next);
    if (next.every((d) => d !== '')) onComplete?.(next.join(''));
  }

  /** Write a run of digits starting at `index` (used for paste & autofill). */
  function fillFrom(index, text) {
    const chars = text.replace(/\D/g, '').slice(0, length - index).split('');
    if (chars.length === 0) return;
    const next = [...digits];
    chars.forEach((c, k) => {
      next[index + k] = c;
    });
    commit(next);
    const firstEmpty = next.findIndex((d) => d === '');
    focusAt(firstEmpty === -1 ? length - 1 : firstEmpty);
  }

  function handleChange(index, e) {
    const raw = e.target.value;
    const onlyDigits = raw.replace(/\D/g, '');

    if (!onlyDigits) {
      if (raw === '') {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      }
      return; // non-digit input is ignored (controlled input reverts)
    }

    // Caret was beside an existing digit: keep only the newly typed one.
    if (onlyDigits.length === 2 && digits[index]) {
      const typed = onlyDigits[0] === digits[index] ? onlyDigits[1] : onlyDigits[0];
      const next = [...digits];
      next[index] = typed;
      commit(next);
      if (index < length - 1) focusAt(index + 1);
      return;
    }

    // Multiple digits at once = OS/browser one-time-code autofill.
    if (onlyDigits.length > 1) {
      fillFrom(onlyDigits.length >= length ? 0 : index, onlyDigits);
      return;
    }

    const next = [...digits];
    next[index] = onlyDigits;
    commit(next);
    if (index < length - 1) focusAt(index + 1);
  }

  function handleKeyDown(index, e) {
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault();
        const next = [...digits];
        if (digits[index]) {
          next[index] = '';
          setDigits(next);
        } else if (index > 0) {
          next[index - 1] = '';
          setDigits(next);
          focusAt(index - 1);
        }
        break;
      }
      case 'Delete': {
        e.preventDefault();
        const next = [...digits];
        next[index] = '';
        setDigits(next);
        break;
      }
      case 'ArrowLeft':
        e.preventDefault();
        focusAt(index - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        focusAt(index + 1);
        break;
      case 'Home':
        e.preventDefault();
        focusAt(0);
        break;
      case 'End':
        e.preventDefault();
        focusAt(length - 1);
        break;
      default:
        // Block non-digit printable keys (but keep shortcuts like Ctrl+V).
        if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
        }
    }
  }

  function handlePaste(index, e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    // A full code always fills from the first box, wherever the caret is.
    fillFrom(pasted.length >= length ? 0 : index, pasted);
  }

  const boxTone = {
    idle: 'border-white/12 text-slate-50 focus:border-neon-cyan focus:shadow-[0_0_0_3px_rgb(0_240_255/0.15),0_0_22px_-4px_rgb(0_240_255/0.7)]',
    verifying: 'border-neon-cyan/35 text-neon-cyan/90',
    success: 'border-neon-green text-neon-green shadow-[0_0_20px_-2px_rgb(43_255_154/0.6)]',
    error: 'border-neon-red text-neon-red shadow-[0_0_20px_-2px_rgb(255_77_115/0.6)]',
  }[status];

  return (
    <div className="relative mx-auto w-fit">
      <motion.div
        ref={groupRef}
        role="group"
        aria-label={`Verification code, ${length} digits`}
        aria-describedby={describedBy}
        animate={status === 'error' ? { x: [0, -12, 12, -9, 9, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className="relative flex gap-2 sm:gap-3"
      >
        {digits.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoFocus={autoFocus && i === 0}
            aria-label={`Digit ${i + 1} of ${length}`}
            aria-invalid={status === 'error' || undefined}
            disabled={locked}
            value={digit}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => e.target.select()}
            animate={digit && status === 'idle' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'h-14 w-[clamp(2.6rem,12.5vw,3.5rem)] rounded-xl border bg-white/[0.04] text-center font-mono text-2xl font-bold caret-neon-cyan outline-none transition-[border-color,box-shadow,color,opacity] duration-300 sm:h-16',
              'disabled:cursor-default',
              digit && status === 'idle' && 'border-neon-cyan/45 bg-neon-cyan/[0.05]',
              status === 'success' || status === 'error' ? 'opacity-60' : '',
              boxTone,
            )}
          />
        ))}
      </motion.div>

      <StatusRing status={status} width={box.width} height={box.height} />
      <StatusBadge status={status} />

      <p className="sr-only" role="status" aria-live="assertive">
        {status === 'verifying' && 'Verifying code…'}
        {status === 'success' && 'Code verified.'}
        {status === 'error' && 'Incorrect code.'}
      </p>
    </div>
  );
});

export default OtpInput;

/* ------------------------------------------------------------------ */
/* Orbiting neon ring around the input group (while verifying)         */
/* ------------------------------------------------------------------ */

const RING_PAD = 10;

function StatusRing({ status, width, height }) {
  if (!width) return null;
  const w = width + RING_PAD * 2;
  const h = height + RING_PAD * 2;
  const rect = { x: 1.5, y: 1.5, width: w - 3, height: h - 3, rx: 20 };

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute overflow-visible"
      style={{ left: -RING_PAD, top: -RING_PAD }}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
    >
      <defs>
        <linearGradient id="otp-ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <AnimatePresence>
        {status === 'verifying' && (
          <motion.g
            key="orbit"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            // "Morph": the ring collapses toward the centre as the badge grows out of it.
            exit={{ opacity: 0, scale: 0.35, transition: { duration: 0.32, ease: [0.55, 0, 0.3, 1] } }}
            style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
          >
            <rect {...rect} fill="none" stroke="rgb(0 240 255 / 0.12)" strokeWidth="2" />
            <rect
              {...rect}
              pathLength="100"
              fill="none"
              stroke="url(#otp-ring-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="ring-comet"
              style={{ filter: 'drop-shadow(0 0 6px #00f0ff) drop-shadow(0 0 2px #00f0ff)' }}
            />
            <rect
              {...rect}
              pathLength="100"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              strokeLinecap="round"
              className="ring-comet-b"
              style={{ filter: 'drop-shadow(0 0 6px #8b5cf6)' }}
            />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Result badge: stroke-drawn ✓ or ✕                                    */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }) {
  const show = status === 'success' || status === 'error';
  const success = status === 'success';
  const color = success ? '#2bff9a' : '#ff4d73';
  const draw = (delay, duration = 0.32) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { delay, duration, ease: 'easeOut' }, opacity: { delay, duration: 0.01 } },
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={status}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
          transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.12 }}
        >
          <div
            className="grid size-[72px] place-items-center rounded-full bg-void/85 backdrop-blur-md"
            style={{ boxShadow: `0 0 0 1px ${color}33, 0 0 40px -4px ${color}aa, inset 0 0 24px -8px ${color}88` }}
          >
            <svg viewBox="0 0 52 52" className="size-14" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
              <motion.circle cx="26" cy="26" r="23" strokeWidth="2.5" {...draw(0.1, 0.4)} style={{ rotate: -90 }} />
              {success ? (
                <motion.path d="M15.5 27.5 22.5 34.5 37 19" strokeWidth="3.5" {...draw(0.45, 0.35)} />
              ) : (
                <>
                  <motion.path d="M18 18 34 34" strokeWidth="3.5" {...draw(0.45, 0.22)} />
                  <motion.path d="M34 18 18 34" strokeWidth="3.5" {...draw(0.65, 0.22)} />
                </>
              )}
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
