import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '../lib/cn';

/**
 * Terminal-style heading that "types" its text with a blinking caret.
 *
 * Accessibility: screen readers get the full text immediately (sr-only);
 * the animated copy is aria-hidden. An invisible full-length copy reserves
 * the final size so nothing reflows while typing.
 */
export default function TypingHeading({ text, as: Tag = 'h1', speed = 42, className }) {
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState(reduceMotion ? text.length : 0);

  useEffect(() => {
    if (reduceMotion) {
      setTyped(text.length);
      return undefined;
    }
    setTyped(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, reduceMotion]);

  return (
    <Tag className={cn('font-mono', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="relative block">
        <span className="invisible">{text}_</span>
        <span className="absolute inset-0">
          {text.slice(0, typed)}
          <span className="animate-blink text-neon-cyan">_</span>
        </span>
      </span>
    </Tag>
  );
}
