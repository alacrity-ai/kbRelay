import { useLayoutEffect, useRef, useState } from 'react';
import type { UserDto } from '@kbrelay/shared';

interface Props {
  value: string;
  onChange: (v: string) => void;
  users: UserDto[];
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}

/** The `@…` fragment immediately before the caret, if the caret is inside a
 *  mention token (email-safe: the `@` must not follow a word char). */
function mentionContext(value: string, caret: number): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0 && /[a-z0-9_-]/i.test(value[i]!)) i--;
  if (i < 0 || value[i] !== '@') return null;
  const before = i === 0 ? '' : value[i - 1]!;
  if (before && /\w/.test(before)) return null; // foo@bar — an email, not a mention
  return { start: i, query: value.slice(i + 1, caret) };
}

/**
 * A textarea with @-mention autocomplete. Typing `@` opens a popover of tenant
 * users (filtered by name/handle); ↑/↓ + Enter/Tab or click inserts `@handle `.
 * Only users with a handle are mentionable. Purely a typing affordance — the
 * server re-parses and is authoritative.
 */
export default function MentionTextArea({ value, onChange, users, placeholder, rows = 4, autoFocus }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);

  const candidates = users.filter((u) => u.handle);
  const q = query.toLowerCase();
  const matches = candidates
    .filter((u) => !q || u.handle!.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
    .slice(0, 6);

  // Restore the caret after a programmatic insert.
  useLayoutEffect(() => {
    if (pendingCaret != null && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(pendingCaret, pendingCaret);
      setPendingCaret(null);
    }
  }, [pendingCaret]);

  function sync() {
    const el = ref.current;
    if (!el) return;
    const ctx = mentionContext(el.value, el.selectionStart ?? 0);
    if (ctx) {
      setQuery(ctx.query);
      setActive(0);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }

  function choose(u: UserDto) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart ?? value.length;
    const ctx = mentionContext(value, caret);
    if (!ctx) return;
    const insert = `@${u.handle} `;
    const next = value.slice(0, ctx.start) + insert + value.slice(caret);
    onChange(next);
    setOpen(false);
    setPendingCaret(ctx.start + insert.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(matches[active]!); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  }

  return (
    <div className="mention-wrap">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); sync(); }}
        onKeyDown={onKeyDown}
        onClick={sync}
        onKeyUp={(e) => { if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) sync(); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      />
      {open && matches.length > 0 && (
        <div className="mention-popover" role="listbox">
          {matches.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={`mention-option ${i === active ? 'active' : ''}`}
              // onMouseDown (not click) so it fires before the textarea blur closes us.
              onMouseDown={(e) => { e.preventDefault(); choose(u); }}
            >
              <span className="avatar sm" style={{ background: u.color }}>
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="mention-option-name">{u.name}</span>
              <span className="mention-option-handle">@{u.handle}</span>
              <span className={`kind-badge ${u.kind}`}>{u.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
