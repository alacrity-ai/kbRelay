import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardDto, UserDto } from '@kbrelay/shared';
import { UNASSIGNED_COLOR } from '@kbrelay/shared';

type CardBodyProps = {
  card: CardDto;
  users: UserDto[];
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

/** Presentational card body — reused by the sortable card and the DragOverlay. */
export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(function CardBody(
  { card, users, className = '', style, ...rest },
  ref,
) {
  const assignee = users.find((u) => u.id === card.assigneeUserId);
  // A card's color is its assignee's color (v0.2.0); gray if unassigned.
  const color = assignee?.color ?? UNASSIGNED_COLOR;
  return (
    <div
      ref={ref}
      className={`card ${className}`}
      style={{ borderLeftColor: color, ...style }}
      {...rest}
    >
      {card.key && <div className="card-key">{card.key}</div>}
      <div className="card-title">{card.summary}</div>
      {assignee && (
        <div className="card-meta">
          <span className="assignee-chip">
            <span className="dot" style={{ background: assignee.color }} />
            {assignee.name}
          </span>
        </div>
      )}
    </div>
  );
});

/** A draggable, sortable card. Click (no drag movement) opens the viewer. */
export default function CardItem({
  card,
  users,
  onOpen,
}: {
  card: CardDto;
  users: UserDto[];
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <CardBody
      ref={setNodeRef}
      card={card}
      users={users}
      className={isDragging ? 'dragging' : ''}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    />
  );
}
