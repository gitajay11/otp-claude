import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import OtpInput from './OtpInput';
import Button from './Button';
import { useToast } from './Toast';
import { formatClock, useCountdown } from '../hooks/useCountdown';
import { sleep } from '../lib/cn';

/** Errors after which the current code can no longer be used. */
const DEAD_CODE_ERRORS = new Set(['OTP_LOCKED', 'OTP_EXPIRED', 'OTP_NOT_FOUND']);

// Animation pacing (ms) — long enough to read, short enough to feel snappy.
const MIN_SPINNER_MS = 900;
const SUCCESS_HOLD_MS = 1300;
const ERROR_HOLD_MS = 1150;

/**
 * Shared "enter your code" step used by both Sign Up and Log In.
 *
 * @param {string}   email
 * @param {number}   resendAfterSec   initial resend cooldown from the server
 * @param {number}   expiresInSec     code lifetime from the server
 * @param {(code: string) => Promise<any>} onVerify   API call; rejects with ApiError
 * @param {() => Promise<{resendAfterSec:number, expiresInSec:number}>} onResend
 * @param {(result: any) => void} onSuccess  called after the success animation
 * @param {() => void} onEditEmail
 */
export default function OtpVerification({ email, resendAfterSec = 30, expiresInSec = 300, onVerify, onResend, onSuccess, onEditEmail }) {
  const toast = useToast();
  const otpRef = useRef(null);
  const messageId = useId();

  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState(null); // { tone: 'error'|'info', text }
  const [codeDead, setCodeDead] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, restartResend] = useCountdown(resendAfterSec);
  const [expiresIn, restartExpiry] = useCountdown(expiresInSec);

  // Mirror the server's expiry locally so the UI doesn't invite a doomed attempt.
  useEffect(() => {
    if (expiresIn === 0 && !codeDead && status === 'idle') {
      setCodeDead(true);
      setMessage({ tone: 'error', text: 'This code has expired. Request a new one.' });
    }
  }, [expiresIn, codeDead, status]);

  async function handleComplete(code) {
    if (status !== 'idle' || codeDead) return;
    setStatus('verifying');
    setMessage(null);
    const startedAt = performance.now();
    const holdSpinner = () => sleep(Math.max(0, MIN_SPINNER_MS - (performance.now() - startedAt)));

    try {
      const result = await onVerify(code);
      await holdSpinner();
      setStatus('success');
      setMessage({ tone: 'success', text: 'Identity verified. Redirecting…' });
      await sleep(SUCCESS_HOLD_MS);
      onSuccess(result);
    } catch (err) {
      await holdSpinner();
      setStatus('error');
      const dead = DEAD_CODE_ERRORS.has(err.code);
      setMessage({ tone: 'error', text: err.message });
      if (dead) {
        setCodeDead(true);
        toast.error('Code no longer valid', err.message);
      } else if (err.code !== 'OTP_INVALID') {
        toast.error('Verification failed', err.message);
      }
      await sleep(ERROR_HOLD_MS);
      otpRef.current?.clear();
      setStatus('idle');
      if (!dead) otpRef.current?.focus(0);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await onResend();
      restartResend(res.resendAfterSec);
      restartExpiry(res.expiresInSec);
      setCodeDead(false);
      setMessage(null);
      otpRef.current?.clear();
      otpRef.current?.focus(0);
      toast.success('New code sent', `Check ${email} for a fresh 5-digit code.`);
    } catch (err) {
      if (err.retryAfterSec) restartResend(err.retryAfterSec);
      toast.error('Could not resend code', err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <p className="mb-8 text-sm leading-relaxed text-slate-300">
        We sent a 5-digit code to{' '}
        <span className="break-all font-mono font-semibold text-neon-cyan text-glow-cyan">{email}</span>. Enter it below.
      </p>

      <OtpInput ref={otpRef} status={status} disabled={codeDead} onComplete={handleComplete} describedBy={messageId} />

      {/* Status line (live region) */}
      <div id={messageId} className="mt-6 min-h-[2.75rem] text-center" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {message ? (
            <motion.p
              key={message.text}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={
                message.tone === 'error'
                  ? 'text-sm text-neon-red'
                  : message.tone === 'success'
                    ? 'font-mono text-sm text-neon-green'
                    : 'text-sm text-slate-300'
              }
            >
              {message.text}
            </motion.p>
          ) : (
            <motion.p
              key="expiry"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-mono text-xs text-slate-400"
            >
              {status === 'verifying' ? (
                <span className="text-neon-cyan">verifying_code…</span>
              ) : (
                <>
                  code expires in <span className={expiresIn <= 60 ? 'text-amber-300' : 'text-slate-200'}>{formatClock(expiresIn)}</span>
                </>
              )}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="link" onClick={onEditEmail} disabled={status === 'verifying' || status === 'success'}>
          ← Edit email
        </Button>

        {resendIn > 0 ? (
          <span className="font-mono text-xs text-slate-400" aria-live="off">
            Resend OTP in <span className="tabular-nums text-slate-200">{formatClock(resendIn)}</span>
          </span>
        ) : (
          <Button
            variant="link"
            onClick={handleResend}
            loading={resending}
            loadingText="Sending…"
            disabled={status === 'verifying' || status === 'success'}
          >
            ↻ Resend OTP
          </Button>
        )}
      </div>
    </div>
  );
}
