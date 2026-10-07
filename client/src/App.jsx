import { Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import Background from './components/Background';
import Spinner from './components/Spinner';
import { useAuth } from './context/AuthContext';
import SignUp from './pages/SignUp';
import LogIn from './pages/LogIn';
import Dashboard from './pages/Dashboard';

/** Only for signed-in users. */
function Protected({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <BootScreen />;
  return status === 'authenticated' ? children : <Navigate to="/login" replace />;
}

/** Only for guests — signed-in users go straight to the dashboard. */
function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'loading') return <BootScreen />;
  return status === 'guest' ? children : <Navigate to="/dashboard" replace />;
}

function BootScreen() {
  return (
    <div className="flex items-center gap-3 font-mono text-sm text-neon-cyan" role="status">
      <Spinner /> booting secure session…
    </div>
  );
}

function Header() {
  return (
    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
      <Link to="/" className="group flex items-center gap-2.5 rounded-lg" aria-label="Nexus home">
        <img src="/favicon.svg" alt="" className="size-8 transition group-hover:drop-shadow-[0_0_10px_#00f0ff]" />
        <span className="font-mono text-sm font-bold tracking-[0.3em] text-slate-100">
          NEXUS<span className="text-neon-violet">//</span>
          <span className="text-neon-cyan">AUTH</span>
        </span>
      </Link>
      <span className="hidden items-center gap-2 rounded-full border border-neon-green/25 bg-neon-green/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-green sm:flex">
        <span className="size-1.5 animate-pulse rounded-full bg-neon-green" /> secure channel
      </span>
    </header>
  );
}

export default function App() {
  const location = useLocation();

  return (
    // reducedMotion="user": honour prefers-reduced-motion for every Framer animation.
    <MotionConfig reducedMotion="user">
      <Background />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-void-2 focus:px-4 focus:py-2 focus:text-neon-cyan"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="relative z-20 flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:py-10" style={{ perspective: 1600 }}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
              <Route path="/login" element={<GuestOnly><LogIn /></GuestOnly>} />
              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="*" element={<Navigate to="/signup" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
        <footer className="px-4 pb-6 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500 sm:tracking-[0.25em]">
          passwordless · email otp · encrypted session
        </footer>
      </div>
    </MotionConfig>
  );
}
