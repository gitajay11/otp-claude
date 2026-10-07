import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import AuthCard from '../components/AuthCard';
import Input from '../components/Input';
import Button from '../components/Button';
import OtpVerification from '../components/OtpVerification';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { validateEmail } from '../lib/validation';
import { SHAKE, stepVariants } from '../lib/motion';

export default function LogIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signIn } = useAuth();
  const shake = useAnimationControls();
  const emailRef = useRef(null);

  const [step, setStep] = useState('form');
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [sending, setSending] = useState(false);
  const [otpSession, setOtpSession] = useState(null); // { email, resendAfterSec, expiresAt }

  const clientError = validateEmail(email);
  const error = serverError ?? ((touched || submitted) && clientError) ?? undefined;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    if (clientError) {
      shake.start(SHAKE);
      emailRef.current?.focus();
      return;
    }

    const normalized = email.trim();
    setSending(true);
    try {
      const res = await api.loginSendOtp(normalized);
      setOtpSession({ email: res.email, resendAfterSec: res.resendAfterSec, expiresAt: Date.now() + res.expiresInSec * 1000 });
      setStep('otp');
      toast.success('Verification code sent', `Check ${res.email} — the code expires in 5 minutes.`);
    } catch (err) {
      // Returned via "Edit email" with the same address: the previous code is still valid.
      if (err.code === 'OTP_COOLDOWN' && otpSession?.email === normalized.toLowerCase()) {
        setOtpSession((s) => ({ ...s, resendAfterSec: err.retryAfterSec }));
        setStep('otp');
        return;
      }
      shake.start(SHAKE);
      if (err.code === 'EMAIL_NOT_FOUND') {
        setServerError(
          <>
            No account found for this email.{' '}
            <Link to="/signup" state={{ email: normalized }} className="font-semibold text-neon-cyan underline underline-offset-2">
              Sign up instead
            </Link>
          </>,
        );
        toast.error('Account not found', 'There is no account registered with that email.', {
          action: { label: 'Create an account', onClick: () => navigate('/signup', { state: { email: normalized } }) },
        });
        emailRef.current?.focus();
      } else if (err.code === 'VALIDATION_ERROR') {
        setServerError(err.fields.email ?? err.message);
      } else {
        toast.error('Could not send code', err.message);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    const res = await api.loginSendOtp(otpSession.email);
    setOtpSession((s) => ({ ...s, expiresAt: Date.now() + res.expiresInSec * 1000 }));
    return res;
  }

  function handleVerified({ user }) {
    signIn(user);
    toast.success(`Welcome back, ${user.firstName}`, 'You are now logged in.');
    navigate('/dashboard', { replace: true });
  }

  const dir = step === 'otp' ? 1 : -1;

  return (
    <AuthCard
      kicker={step === 'form' ? 'passwordless login' : 'verify identity'}
      title={step === 'form' ? '> establishing secure session' : '> awaiting verification'}
      subtitle={step === 'form' ? 'Enter your email and we’ll send you a one-time code.' : undefined}
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-mono font-semibold text-neon-cyan hover:underline underline-offset-4">
            Create an account →
          </Link>
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        {step === 'form' ? (
          <motion.div key="form" custom={dir} variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <motion.form animate={shake} onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Log in">
              <Input
                ref={emailRef}
                id="login-email"
                type="email"
                label="Email ID"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={254}
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setServerError(null);
                }}
                onBlur={() => setTouched(true)}
                error={error}
              />
              <Button type="submit" className="!mt-7" loading={sending} loadingText="Transmitting…">
                Send OTP
              </Button>
            </motion.form>
          </motion.div>
        ) : (
          <motion.div key="otp" custom={dir} variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <OtpVerification
              email={otpSession.email}
              resendAfterSec={otpSession.resendAfterSec}
              expiresInSec={Math.max(0, Math.round((otpSession.expiresAt - Date.now()) / 1000))}
              onVerify={(code) => api.loginVerifyOtp(otpSession.email, code)}
              onResend={handleResend}
              onSuccess={handleVerified}
              onEditEmail={() => setStep('form')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </AuthCard>
  );
}
