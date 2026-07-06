import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ColumnDto } from '@kbrelay/shared';

/**
 * Board minimap scrubber (KBR-106) — a fixed-size, bottom-right overview of the
 * board that doubles as a horizontal-scroll control. Each column is drawn as a
 * brighter header rectangle with its cards stacked below, colored to the real
 * column color; drag (or click-drag) anywhere to pan the board. Desktop only,
 * and only when the board actually overflows horizontally (both enforced in
 * CSS + the overflow guard here).
 */

/** Card rectangles drawn per column before silent truncation (a column with
 *  hundreds mustn't tower — the widget is a static size). */
export const MINI_CARD_CAP = 7;
const NEUTRAL = '#64748b';

export interface MiniColumn {
  id: string;
  name: string;
  color: string;
  /** Rectangles to draw (min(total, cap)). */
  shown: number;
  /** True card count, surfaced on hover. */
  total: number;
}

/** The capped, colored per-column model the mini-render draws. */
export function miniColumns(
  columns: ColumnDto[],
  counts: Record<string, number>,
  cap = MINI_CARD_CAP,
): MiniColumn[] {
  return columns.map((c) => {
    const total = counts[c.id] ?? 0;
    return { id: c.id, name: c.name, color: c.color ?? NEUTRAL, shown: Math.min(total, cap), total };
  });
}

/**
 * Target scrollLeft for a scrub at horizontal `fraction` (0..1) of the minimap,
 * centering the viewport on the cursor and clamped to the scrollable range.
 */
export function scrubToScrollLeft(fraction: number, scrollWidth: number, clientWidth: number): number {
  const max = Math.max(0, scrollWidth - clientWidth);
  const target = fraction * scrollWidth - clientWidth / 2;
  return Math.max(0, Math.min(max, target));
}

interface Metrics {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export default function BoardMinimap({
  scrollRef,
  columns,
  counts,
  dragging = false,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  columns: ColumnDto[];
  counts: Record<string, number>;
  /** A card is mid-drag on the board — dim + disable so we don't fight dnd. */
  dragging?: boolean;
}) {
  const [metrics, setMetrics] = useState<Metrics>({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setMetrics({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [scrollRef, measure]);

  // Contents changed (columns added/removed, cards moved) → re-measure so the
  // viewport indicator and overflow guard stay honest.
  useEffect(() => { measure(); }, [columns, counts, measure]);

  const scrubTo = useCallback((clientX: number) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    const fraction = (clientX - rect.left) / rect.width;
    el.scrollLeft = scrubToScrollLeft(fraction, el.scrollWidth, el.clientWidth);
  }, [scrollRef]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (dragging) return;
    scrubbing.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    scrubTo(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!scrubbing.current) return;
    scrubTo(e.clientX);
  };
  const endScrub = (e: React.PointerEvent) => {
    scrubbing.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const overflow = metrics.scrollWidth - metrics.clientWidth > 1;
  if (columns.length === 0 || !overflow) return null;

  const viewLeft = (metrics.scrollLeft / metrics.scrollWidth) * 100;
  const viewWidth = (metrics.clientWidth / metrics.scrollWidth) * 100;
  const cols = miniColumns(columns, counts);

  return (
    <div className={`bmini ${dragging ? 'bmini-idle' : ''}`}>
      <div
        ref={trackRef}
        className="bmini-track"
        role="scrollbar"
        aria-orientation="horizontal"
        aria-controls="board-scroll"
        aria-label="Board minimap — drag to scroll"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(viewLeft)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
      >
        {cols.map((c) => (
          <div
            key={c.id}
            className="bmini-col"
            title={`${c.name} — ${c.total} card${c.total === 1 ? '' : 's'}`}
          >
            <span className="bmini-head" style={{ background: c.color }} />
            {Array.from({ length: c.shown }, (_, i) => (
              <span key={i} className="bmini-card" style={{ background: c.color }} />
            ))}
          </div>
        ))}
        <div className="bmini-view" style={{ left: `${viewLeft}%`, width: `${viewWidth}%` }} />
      </div>
    </div>
  );
}
