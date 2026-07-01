import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * A small popover: a trigger button + a panel that closes on outside-click,
 * Escape, or any click inside it (menu items act then dismiss). No deps.
 */
export default function Dropdown({
  trigger,
  children,
  align = 'left',
  className = '',
  triggerClassName = '',
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  triggerClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`dropdown ${className}`} ref={ref}>
      <button
        className={`dropdown-trigger ${triggerClassName}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </button>
      {open && (
        <div className={`dropdown-panel ${align === 'right' ? 'align-right' : ''}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
