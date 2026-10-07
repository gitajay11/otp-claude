import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import TypingHeading from '../components/TypingHeading';
import Button from '../components/Button';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { findCountry } from '../lib/countries';
import { flipVariants } from '../lib/motion';

const formatDate = (ms) =>
  ms
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
    : '—';

const LOG_LINES = [
  ['ok', 'email ownership verified via one-time code'],
  ['ok', 'session token issued · httpOnly cookie'],
  ['ok', 'secure channel established'],
  ['ready', 'awaiting further instructions'],
];

const list = { animate: { transition: { staggerChildren: 0.07, delayChildren: 0.35 } } };
const item = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

/** Welcome / dashboard page shown after a successful sign-up or login. */
export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [leaving, setLeaving] = useState(false);
  const country = findCountry(user.country);

  async function handleLogout() {
    setLeaving(true);
    await signOut();
    toast.info('Session terminated', 'You have been logged out.');
    navigate('/login', { replace: true });
  }

  const fields = [
    ['Email', user.email],
    ['Mobile', `${user.dialCode} ${user.phone}`],
    ['Country', country ? `${country.flag} ${country.name}` : user.country],
    ['Member since', formatDate(user.createdAt)],
    ['Last login', formatDate(user.lastLoginAt)],
    ['User ID', `#${String(user.id).padStart(6, '0')}`],
  ];

  return (
    <motion.section
      variants={flipVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ transformPerspective: 1400 }}
      className="glass w-full max-w-2xl rounded-3xl p-5 sm:p-9"
    >
      <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-neon-green">
        <span className="inline-block size-1.5 rounded-full bg-neon-green shadow-[0_0_8px_var(--color-neon-green)]" />
        access granted
      </div>
      <TypingHeading text={`> welcome, ${user.firstName.toLowerCase()}`} className="text-2xl font-bold text-slate-50 sm:text-3xl" />
      <p className="mt-2 text-sm text-slate-400">
        Good to see you, {user.firstName} {user.lastName}. Your identity is verified and your session is active.
      </p>

      <motion.dl variants={list} initial="initial" animate="animate" className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(([label, value]) => (
          <motion.div
            key={label}
            variants={item}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 transition hover:border-neon-cyan/30"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{label}</dt>
            <dd className="mt-1 truncate text-[15px] text-slate-100" title={typeof value === 'string' ? value : undefined}>
              {value}
            </dd>
          </motion.div>
        ))}
      </motion.dl>

      <motion.div
        variants={list}
        initial="initial"
        animate="animate"
        className="mt-6 rounded-xl border border-neon-cyan/15 bg-black/30 p-4 font-mono text-xs leading-6"
        aria-label="Session log"
      >
        {LOG_LINES.map(([tag, text]) => (
          <motion.p key={text} variants={item} className="text-slate-300">
            <span className={tag === 'ok' ? 'text-neon-green' : 'text-neon-cyan'}>[{tag}]</span> {text}
          </motion.p>
        ))}
      </motion.div>

      <div className="mt-8 flex justify-end">
        <Button variant="ghost" onClick={handleLogout} loading={leaving} loadingText="Terminating…">
          ⏻ Log out
        </Button>
      </div>
    </motion.section>
  );
}
