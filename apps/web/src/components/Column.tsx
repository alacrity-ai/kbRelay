import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CardDto, ColumnDto, ColumnRole, UserDto } from '@kbrelay/shared';
import CardItem from './CardItem';
import { ROLE_META, ROLE_ORDER } from '../lib/roles';

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
}: {
  column: ColumnDto;
  cards: CardDto[];
  users: UserDto[];
  onAddCard: (columnId: string) => void;
  onOpenCard: (card: CardDto) => void;
  onRename: (column: ColumnDto) => void;
  onDelete: (column: ColumnDto) => void;
  onSetRole: (column: ColumnDto, role: ColumnRole | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const role = column.role ? ROLE_META[column.role] : null;

  return (
    <div className="column">
      <div className="column-header">
        <span className="column-dot" style={{ background: column.color ?? '#64748b' }} />
        <span
          className="column-name"
          title="Double-click to rename"
          onDoubleClick={() => onRename(column)}
        >
          {column.name}
        </span>
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
        <span className="column-count">{cards.length}</span>
        <div style={{ flex: 1 }} />
        <div className="column-actions">
          <button className="icon-btn ghost" title="Rename column" onClick={() => onRename(column)} aria-label="Rename column">✎</button>
          <button className="icon-btn ghost" title="Delete column" onClick={() => onDelete(column)} aria-label="Delete column">✕</button>
        </div>
      </div>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`column-body ${isOver ? 'drop-over' : ''}`}>
          {cards.map((c) => (
            <CardItem key={c.id} card={c} users={users} onOpen={() => onOpenCard(c)} />
          ))}
        </div>
      </SortableContext>

      <button className="add-card" onClick={() => onAddCard(column.id)}>+ Add card</button>
    </div>
  );
}
