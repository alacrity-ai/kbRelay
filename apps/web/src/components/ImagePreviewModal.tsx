import { useEffect, useRef, useState, useCallback } from 'react';
import type { AttachmentDto } from '@kbrelay/shared';
import { attachmentBlobUrl } from '../lib/api';
import { useAuthedObjectUrl } from '../lib/authedBlob';
import { formatBytes } from '../lib/attachments';

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View { scale: number; tx: number; ty: number }
const HOME: View = { scale: 1, tx: 0, ty: 0 };

/** Lightbox for a card's image attachments (KBR-93): fixed-size frame, wheel /
 *  double-click / button zoom, drag pan, two-finger pinch+pan on touch, and
 *  slideshow cycling through sibling images (‹ › buttons + arrow keys).
 *  The transform model is `translate(tx,ty) scale(s)` about the viewport
 *  center; zoomAt() keeps the content point under the cursor fixed. */
export default function ImagePreviewModal({ images, startId, onClose }: { images: AttachmentDto[]; startId: string; onClose: () => void }) {
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((a) => a.id === startId)));
  const attachment = images[index];
  const { objectUrl, loading, error, status } = useAuthedObjectUrl(attachmentBlobUrl(attachment.id));
  const [view, setView] = useState<View>(HOME);

  // Cycle with wrap-around; each image starts fresh at 100% / centered.
  const step = useCallback((dir: 1 | -1) => {
    setIndex((i) => (i + dir + images.length) % images.length);
    setView(HOME);
  }, [images.length]);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Live pointer positions (viewport-center coordinates), for drag + pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  const toCenter = useCallback((clientX: number, clientY: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  }, []);

  // Zoom so the content point currently under `p` stays under `p`.
  const zoomAt = useCallback((p: { x: number; y: number }, nextScale: number) => {
    setView((v) => {
      const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const cx = (p.x - v.tx) / v.scale;
      const cy = (p.y - v.ty) / v.scale;
      return { scale: s, tx: p.x - cx * s, ty: p.y - cy * s };
    });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    setView((v) => {
      const s = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const r = s / v.scale;
      return { scale: s, tx: v.tx * r, ty: v.ty * r };
    });
  }, []);

  // React registers wheel listeners passively, so preventDefault (needed to
  // stop the page scrolling behind the lightbox) requires a manual listener.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toCenter(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      setView((v) => {
        const s = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
        const cx = (p.x - v.tx) / v.scale;
        const cy = (p.y - v.ty) / v.scale;
        return { scale: s, tx: p.x - cx * s, ty: p.y - cy * s };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [toCenter]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight' && images.length > 1) { e.stopPropagation(); step(1); }
      else if (e.key === 'ArrowLeft' && images.length > 1) { e.stopPropagation(); step(-1); }
    };
    // Capture phase so Escape closes the lightbox, not the card modal under it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose, step, images.length]);

  // Render-visible pointer count (a ref alone wouldn't update the cursor).
  const [activePointers, setActivePointers] = useState(0);

  function onPointerDown(e: React.PointerEvent) {
    viewportRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, toCenter(e.clientX, e.clientY));
    setActivePointers(pointers.current.size);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = new Map(pointers.current);
    const p = toCenter(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 1) {
      const was = prev.get(e.pointerId)!;
      setView((v) => ({ ...v, tx: v.tx + p.x - was.x, ty: v.ty + p.y - was.y }));
    } else if (pointers.current.size === 2) {
      // Pinch: rescale by the distance ratio and follow the midpoint.
      const [a1, b1] = [...prev.values()];
      const [a2, b2] = [...pointers.current.values()];
      const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      const mid2 = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
      const ratio = dist(a2, b2) / dist(a1, b1);
      setView((v) => {
        const s = clamp(v.scale * ratio, MIN_SCALE, MAX_SCALE);
        const cx = (mid1.x - v.tx) / v.scale;
        const cy = (mid1.y - v.ty) / v.scale;
        return { scale: s, tx: mid2.x - cx * s, ty: mid2.y - cy * s };
      });
    }
  }

  function onPointerEnd(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    setActivePointers(pointers.current.size);
  }

  function onDoubleClick(e: React.MouseEvent) {
    const p = toCenter(e.clientX, e.clientY);
    if (view.scale > 1.01) setView(HOME);
    else zoomAt(p, 2.5);
  }

  const dragging = activePointers > 0;
  return (
    <div className="imgprev-backdrop" onClick={onClose} data-testid="imgprev-backdrop">
      <div className="imgprev-frame" role="dialog" aria-modal="true" aria-label={`Preview of ${attachment.filename}`} onClick={(e) => e.stopPropagation()}>
        <div className="imgprev-header">
          <span className="imgprev-name" title={attachment.filename}>{attachment.filename}</span>
          <span className="imgprev-size">{formatBytes(attachment.sizeBytes)}</span>
          {images.length > 1 && <span className="imgprev-count">{index + 1} / {images.length}</span>}
          <button type="button" className="imgprev-close" aria-label="Close preview" onClick={onClose}>✕</button>
        </div>
        <div
          ref={viewportRef}
          className="imgprev-viewport"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={onDoubleClick}
        >
          {loading && <span className="imgprev-status">Loading image…</span>}
          {status === 404 && <span className="imgprev-status">🗑 Attachment removed</span>}
          {!loading && status !== 404 && (error || !objectUrl) && (
            <span className="imgprev-status">⚠ Couldn’t load {attachment.filename}</span>
          )}
          {objectUrl && (
            <img
              src={objectUrl}
              alt={attachment.filename}
              className="imgprev-img"
              draggable={false}
              style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
            />
          )}
          {images.length > 1 && (
            <>
              {/* stopPropagation: the viewport's pointerdown would otherwise capture
                  the pointer for pan and swallow the click. */}
              <button type="button" className="imgprev-nav prev" aria-label="Previous image" onPointerDown={(e) => e.stopPropagation()} onClick={() => step(-1)}>‹</button>
              <button type="button" className="imgprev-nav next" aria-label="Next image" onPointerDown={(e) => e.stopPropagation()} onClick={() => step(1)}>›</button>
            </>
          )}
        </div>
        <div className="imgprev-footer">
          <button type="button" className="ghost imgprev-zoom" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>−</button>
          <span className="imgprev-pct">{Math.round(view.scale * 100)}%</span>
          <button type="button" className="ghost imgprev-zoom" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>+</button>
          <button type="button" className="ghost imgprev-zoom" onClick={() => setView(HOME)}>Reset</button>
          <span className="imgprev-hint">
            Scroll or pinch to zoom · drag to pan · double-click to toggle{images.length > 1 && ' · ←/→ next image'}
          </span>
        </div>
      </div>
    </div>
  );
}
