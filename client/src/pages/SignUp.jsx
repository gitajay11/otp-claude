import { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import AuthCard from '../components/AuthCard';
import Input from '../components/Input';
import CountryCodeSelect from '../components/CountryCodeSelect';
import Button from '../components/Button';
import OtpVerification from '../components/OtpVerification';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { DEFAULT_COUNTRY, exampleMobile, mobileLengthHint } from '../lib/countries';
import { stripPhoneFormatting, validateSignup } from '../lib/validation';
import { SHAKE, stepVariants } from '../lib/motion';

const FIELD_ORDER = ['firstName', 'lastName', 'email', 'phone'];

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signIn } = useAuth();
  const shake = useAnimationControls();

  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    email: location.state?.email ?? '',
    country: DEFAULT_COUNTRY,
    phone: '',
  });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [otpSession, setOtpSession] = useState(null); // { email, resendAfterSec, expiresAt, snapshot }

  const refs = useRef({});
  const errors = useMemo(() => validateSignup(values), [values]);
  const example = exampleMobile(values.country);

  /** Server errors take precedence; client errors show once a field is touched or the form was submitted. */
  const errorFor = (field) => serverErrors[field] ?? ((touched[field] || submitted) && errors[field]) ?? undefined;

  const update = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setServerErrors(({ [field]: _removed, ...rest }) => rest);
  };
  const onChange = (field) => (e) => update(field, field === 'phone' ? stripPhoneFormatting(e.target.value) : e.target.value);
  const onBlur = (field) => () => setTouched((t) => ({ ...t, [field]: true }));

  const payload = () => ({
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    country: values.country,
    phone: values.phone,
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);

    if (Object.keys(errors).length > 0) {
      shake.start(SHAKE);
      refs.current[FIELD_ORDER.find((f) => errors[f])]?.focus();
      return;
    }

    const body = payload();
    const snapshot = JSON.stringify(body);
    setSending(true);
    try {
      const res = await api.signupSendOtp(body);
      setOtpSession({ email: res.email, resendAfterSec: res.resendAfterSec, expiresAt: Date.now() + res.expiresInSec * 1000, snapshot });
      setStep('otp');
      toast.success('Verification code sent', `Check ${res.email} — the code expires in 5 minutes.`);
    } catch (err) {
      // Came back via "Edit email" without changing anything: the code we already sent is still valid.
      if (err.code === 'OTP_COOLDOWN' && otpSession?.snapshot === snapshot) {
        setOtpSession((s) => ({ ...s, resendAfterSec: err.retryAfterSec }));
        setStep('otp');
        return;
      }
      handleSendError(err, body.email);
    } finally {
      setSending(false);
    }
  }

  function handleSendError(err, email) {
    shake.start(SHAKE);
    if (err.code === 'EMAIL_EXISTS') {
      setServerErrors({
        email: (
          <>
            This email is already registered.{' '}
            <Link to="/login" state={{ email }} className="font-semibold text-neon-cyan underline underline-offset-2">
              Log in instead
            </Link>
          </>
        ),
      });
      toast.error('Account already exists', 'That email is already registered.', {
        action: { label: 'Go to log in', onClick: () => navigate('/login', { state: { email } }) },
      });
      refs.current.email?.focus();
    } else if (err.code === 'VALIDATION_ERROR') {
      setServerErrors(err.fields);
      refs.current[FIELD_ORDER.find((f) => err.fields[f])]?.focus();
    } else {
      toast.error('Could not send code', err.message);
    }
  }

  async function handleResend() {
    const res = await api.signupSendOtp(JSON.parse(otpSession.snapshot));
    setOtpSession((prev) => ({ ...prev, expiresAt: Date.now() + res.expiresInSec * 1000 }));
    return res;
  }

  function handleVerified({ user }) {
    signIn(user);
    toast.success(`Welcome aboard, ${user.firstName}`, 'Your account has been created.');
    navigate('/dashboard', { replace: true });
  }

  const dir = step === 'otp' ? 1 : -1;

  return (
    <AuthCard
      kicker={step === 'form' ? 'new identity · step 1/2' : 'verify identity · step 2/2'}
      title={step === 'form' ? '> initializing secure access' : '> awaiting verification'}
      subtitle={step === 'form' ? 'Create your account. No passwords — just a one-time code sent to your inbox.' : undefined}
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-mono font-semibold text-neon-cyan hover:underline underline-offset-4">
            Log in →
          </Link>
        </>
      }
    >
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        {step === 'form' ? (
          <motion.div key="form" custom={dir} variants={stepVariants} initial="initial" animate="animate" exit="exit">
            <motion.form animate={shake} onSubmit={handleSubmit} noValidate className="space-y-4" aria-label="Sign up">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  ref={(el) => (refs.current.firstName = el)}
                  id="firstName"
                  label="First name"
                  autoComplete="given-name"
                  required
                  maxLength={50}
                  value={values.firstName}
                  onChange={onChange('firstName')}
                  onBlur={onBlur('firstName')}
                  error={errorFor('firstName')}
                />
                <Input
                  ref={(el) => (refs.current.lastName = el)}
                  id="lastName"
                  label="Last name"
                  autoComplete="family-name"
                  required
                  maxLength={50}
                  value={values.lastName}
                  onChange={onChange('lastName')}
                  onBlur={onBlur('lastName')}
                  error={errorFor('lastName')}
                />
              </div>

              <Input
                ref={(el) => (refs.current.email = el)}
                id="email"
                type="email"
                label="Email ID"
                autoComplete="email"
                inputMode="email"
                required
                maxLength={254}
                value={values.email}
                onChange={onChange('email')}
                onBlur={onBlur('email')}
                error={errorFor('email')}
              />

              <div className="flex gap-3">
                <CountryCodeSelect
                  id="country"
                  className="w-[8.5rem] shrink-0"
                  value={values.country}
                  onChange={(iso) => update('country', iso)}
                />
                <Input
                  ref={(el) => (refs.current.phone = el)}
                  id="phone"
                  type="tel"
                  label="Mobile number"
                  autoComplete="tel-national"
                  inputMode="numeric"
                  required
                  maxLength={20}
                  className="min-w-0 flex-1"
                  value={values.phone}
                  onChange={onChange('phone')}
                  onBlur={onBlur('phone')}
                  error={errorFor('phone')}
                  hint={`${mobileLengthHint(values.country)}${example ? ` · e.g. ${example}` : ''}`}
                />
              </div>

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
              onVerify={(code) => api.signupVerifyOtp(otpSession.email, code)}
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
