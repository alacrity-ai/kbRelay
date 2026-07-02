import { forwardRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardDto, UserDto } from '@kbrelay/shared';
import { UNASSIGNED_COLOR } from '@kbrelay/shared';
import AttachmentBadges from './AttachmentBadges';

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
  const reviewer = users.find((u) => u.id === card.reviewerUserId);
  // A card's color is its assignee's color (v0.2.0); gray if unassigned.
  const color = assignee?.color ?? UNASSIGNED_COLOR;
  const counts = card.attachmentCounts;
  const hasBadges = !!counts && counts.image + counts.document + counts.archive + counts.misc > 0;
  const tasks = card.taskCounts;
  return (
    <div
      ref={ref}
      className={`card ${className}`}
      style={{ borderLeftColor: color, ...style }}
      {...rest}
    >
      {card.key && <div className="card-key">{card.key}</div>}
      <div className="card-title">{card.summary}</div>
      {(assignee || reviewer || hasBadges || (tasks && tasks.total > 0)) && (
        <div className="card-meta">
          {assignee ? (
            <span className="assignee-chip">
              <span className="dot" style={{ background: assignee.color }} />
              {assignee.name}
            </span>
          ) : (
            <span />
          )}
          {/* Reviewer chip (v0.17.0, KBR-61): visually distinct — outlined, eye glyph. */}
          {reviewer && (
            <span className="reviewer-chip" title={`Reviewer: ${reviewer.name}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={reviewer.color}
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {reviewer.name}
            </span>
          )}
          {tasks && tasks.total > 0 && (
            <span
              className={`task-chip ${tasks.done === tasks.total ? 'done' : ''}`}
              title={`${tasks.done} of ${tasks.total} checklist items done`}
            >
              ☑ {tasks.done}/{tasks.total}
            </span>
          )}
          {hasBadges && <AttachmentBadges counts={counts} />}
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
