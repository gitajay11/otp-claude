import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { COUNTRIES, findCountry, searchCountries } from '../lib/countries';
import { cn } from '../lib/cn';

/**
 * Searchable country dial-code picker (flag · name · dial code).
 *
 * Implements the WAI-ARIA "select-only combobox with listbox popup" pattern:
 *  - Trigger button: Enter / Space / ↓ / ↑ opens the popup.
 *  - Search field (role=combobox): ↑ ↓ move, Home/End jump, Enter selects,
 *    Esc closes and returns focus to the trigger. Tab closes.
 *  - Clicking outside closes.
 */
export default function CountryCodeSelect({ id, value, onChange, label = 'Country code', className }) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const selected = findCountry(value) ?? COUNTRIES[0];
  const results = useMemo(() => searchCountries(query), [query]);
  const optionId = (iso) => `${baseId}-opt-${iso}`;

  // On open: reset search and highlight the current selection (the search field autofocuses).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, COUNTRIES.findIndex((c) => c.iso === value)));
  }, [open, value]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, results]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function choose(country) {
    onChange(country.iso);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onSearchKeyDown(e) {
    const last = results.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => (i >= last ? 0 : i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => (i <= 0 ? last : i - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[active]) choose(results[active]);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected.name} ${selected.dial}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'flex h-14 w-full items-center gap-2 rounded-xl border bg-white/[0.035] px-3 text-left transition-[border-color,box-shadow] duration-200',
          open
            ? 'border-neon-cyan/70 shadow-[0_0_0_3px_rgb(0_240_255/0.12),0_0_26px_-6px_rgb(0_240_255/0.55)]'
            : 'border-white/10 hover:border-white/20',
        )}
      >
        <span className="text-xl leading-none" aria-hidden="true">
          {selected.flag}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">Code</span>
          <span className="font-mono text-[15px] font-semibold text-slate-50">{selected.dial}</span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={cn('ml-auto size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180 text-neon-cyan')}
        >
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute left-0 top-full z-40 mt-2 w-[min(21rem,calc(100vw-3rem))] origin-top-left overflow-hidden rounded-2xl border border-neon-cyan/25 bg-void-2/95 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.9),0_0_40px_-14px_rgb(0_240_255/0.5)] backdrop-blur-xl"
          >
            <div className="border-b border-white/[0.07] p-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 focus-within:ring-1 focus-within:ring-neon-cyan/50">
                <span aria-hidden="true" className="font-mono text-neon-cyan">&gt;</span>
                <input
                  ref={searchRef}
                  autoFocus
                  type="text"
                  role="combobox"
                  aria-label="Search countries by name or dial code"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={results[active] ? optionId(results[active].iso) : undefined}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder="search country or +code"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 w-full bg-transparent font-mono text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <ul ref={listRef} id={listId} role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center font-mono text-xs text-slate-500">no_matches_found</li>
              )}
              {results.map((c, i) => {
                const isSelected = c.iso === value;
                const isActive = i === active;
                return (
                  <li
                    key={c.iso}
                    id={optionId(c.iso)}
                    role="option"
                    aria-selected={isSelected}
                    data-index={i}
                    onPointerMove={() => !isActive && setActive(i)}
                    onClick={() => choose(c)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive ? 'bg-neon-cyan/10 text-slate-50' : 'text-slate-300',
                    )}
                  >
                    <span className="text-lg leading-none" aria-hidden="true">
                      {c.flag}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className={cn('font-mono text-xs', isActive || isSelected ? 'text-neon-cyan' : 'text-slate-500')}>{c.dial}</span>
                    {isSelected && (
                      <span aria-hidden="true" className="text-neon-cyan">
                        ✓
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
