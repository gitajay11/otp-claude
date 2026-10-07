import { useCallback, useEffect, useState } from 'react';

/**
 * Drift-free countdown in whole seconds. Tracks an absolute deadline, so it
 * stays accurate even if the tab is throttled in the background.
 *
 * @returns {[number, (seconds: number) => void]} [secondsLeft, restart]
 */
export function useCountdown(initialSeconds) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      return left;
    };
    if (tick() === 0) return undefined;
    const id = setInterval(() => {
      if (tick() === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const restart = useCallback((seconds) => setDeadline(Date.now() + seconds * 1000), []);
  return [secondsLeft, restart];
}

/** 75 → "1:15" */
export const formatClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
