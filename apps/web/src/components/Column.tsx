import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CardDto, ColumnDto, ColumnRole, UserDto } from '@kbrelay/shared';
import CardItem from './CardItem';
import { ROLE_META, ROLE_ORDER, ROLE_HELP } from '../lib/roles';

/** A board lane: droppable body + a vertical sortable context of cards. */
export default function Column({
  column,
  cards,
  users,
  onAddCard,
  onOpenCard,
  onRename,
  onDelete,
  onSetRole,
  onArchiveAll,
  archivedCount,
  onViewArchive,
}: {
  column: ColumnDto;
  cards: CardDto[];
  users: UserDto[];
  onAddCard: (columnId: string) => void;
  onOpenCard: (card: CardDto) => void;
  onRename: (column: ColumnDto) => void;
  onDelete: (column: ColumnDto) => void;
  onSetRole: (column: ColumnDto, role: ColumnRole | null) => void;
  /** Present only on the done-role lane (KBR-60): archive every card in it. */
  onArchiveAll?: () => void;
  /** Project's archived-card count (KBR-75) — badge shown on the done lane. */
  archivedCount?: number;
  /** Open Project Settings → Archive from the done-lane badge (KBR-75). */
  onViewArchive?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const role = column.role ? ROLE_META[column.role] : null;

  const roleHelp = column.role
    ? ROLE_HELP[column.role]
    : 'No role — a neutral lane. Nothing automatic happens here (a good spot for Backlog).';

  return (
    <div className="column">
      <div className="column-header">
        {/* Row 1: identity + count + actions. Name ellipsizes so it never wraps. */}
        <div className="column-header-top">
          <span className="column-dot" style={{ background: column.color ?? '#64748b' }} />
          <span
            className="column-name"
            title="Double-click to rename"
            onDoubleClick={() => onRename(column)}
          >
            {column.name}
          </span>
          <span className="column-count">{cards.length}</span>
          <div className="column-actions">
            {onArchiveAll && cards.length > 0 && (
              <button className="icon-btn ghost" title={`Archive all ${cards.length} cards`} onClick={onArchiveAll} aria-label="Archive all cards in this column">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="5" rx="1" />
                  <path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
                  <path d="M10 13h4" />
                </svg>
              </button>
            )}
            <button className="icon-btn ghost" title="Rename column" onClick={() => onRename(column)} aria-label="Rename column">✎</button>
            <button className="icon-btn ghost" title="Delete column" onClick={() => onDelete(column)} aria-label="Delete column">✕</button>
          </div>
        </div>
        {/* Row 2: role picker + a (?) popover explaining the role. Fixed second
            row keeps every header the same height so lanes line up. */}
        <div className="column-header-bottom">
          <select
            className="column-role-select"
            value={column.role ?? ''}
            title="Set this lane's role — one lane per role (reassigning moves it)"
            aria-label={`Role for ${column.name}`}
            style={role ? { color: role.color, borderColor: role.color } : undefined}
            onChange={(e) => onSetRole(column, (e.target.value || null) as ColumnRole | null)}
          >
            <option value="">No role</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>{ROLE_META[r].label}</option>
            ))}
          </select>
          <RoleHelp role={role} roleHelp={roleHelp} />
          {/* Archived count on the done lane (KBR-75): right-justified, deep-links
              to Project Settings → Archive. */}
          {column.role === 'done' && !!archivedCount && archivedCount > 0 && (
            <button
              className="column-archived-badge"
              onClick={onViewArchive}
              title={`View ${archivedCount.toLocaleString()} archived card${archivedCount === 1 ? '' : 's'}`}
              aria-label={`${archivedCount} archived cards — open the archive`}
            >
              ({archivedCount.toLocaleString()}) Archived
            </button>
          )}
        </div>
      </div>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`column-body ${isOver ? 'drop-over' : ''}`}>
          {cards.map((c) => (
            <CardItem key={c.id} card={c} users={users} inDoneColumn={column.role === 'done'} onOpen={() => onOpenCard(c)} />
          ))}
        </div>
      </SortableContext>

      <button className="add-card" onClick={() => onAddCard(column.id)}>+ Add card</button>
    </div>
  );
}

/**
 * The (?) role-help popover. A click-opened popover, so it must dismiss the way
 * users expect one to — on outside click or Escape — rather than lingering until
 * you click the toggle again (KBR-39). (A timeout would hide it mid-read, so we
 * dismiss on interaction instead, which is the tooltip/popover best practice.)
 */
function RoleHelp({ role, roleHelp }: { role: (typeof ROLE_META)[ColumnRole] | null; roleHelp: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="role-help" ref={ref}>
      <button
        type="button"
        className="role-help-toggle"
        aria-label="How this role behaves"
        title="How this role behaves"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <div className="role-popover" role="tooltip">
          {role && (
            <span className="flowdemo-role" style={{ color: role.color, borderColor: role.color }}>{role.label}</span>
          )}
          <p>{roleHelp}</p>
        </div>
      )}
    </div>
  );
}
