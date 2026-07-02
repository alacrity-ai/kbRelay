import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { CardDto, ColumnDto, ColumnRole, LabelDto, UserDto } from '@kbrelay/shared';
import * as api from '../lib/api';
import type { CardInput } from '../lib/api';
import Column from './Column';
import { CardBody } from './CardItem';
import CardModal, { type CardScrollTarget } from './CardModal';
import { useDialog } from './Dialog';
import { EMPTY_FILTER, cardMatchesFilter, type BoardFilter } from './FilterModal';

export interface BoardNav {
  cardId: string;
  /** Where to scroll/flash inside the modal (mention jumps). Omitted = just open. */
  source?: CardScrollTarget;
}

const STEP = 1000;
function rankBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return STEP;
  if (before == null) return after! - STEP;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}

type ModalState =
  | { mode: 'create'; columnId: string }
  | { mode: 'view'; card: CardDto } // open an existing card (modal toggles view/edit itself)
  | null;

export default function Board({ projectId, users, meId, reloadNonce = 0, filter = EMPTY_FILTER, projectLabels = [], nav = null, onNavHandled }: { projectId: string; users: UserDto[]; meId: string; reloadNonce?: number; filter?: BoardFilter; projectLabels?: LabelDto[]; nav?: BoardNav | null; onNavHandled?: () => void }) {
  const [columns, setColumns] = useState<ColumnDto[]>([]);
  const [items, setItems] = useState<Record<string, string[]>>({});
  const [cardsById, setCardsById] = useState<Record<string, CardDto>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [scrollTo, setScrollTo] = useState<CardScrollTarget | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dialog = useDialog();
  // Refs read by the background poller (avoid stale closures / overlapping loads).
  const draggingRef = useRef(false);
  const loadingRef = useRef(false);

  const sensors = useSensors(
    // Mouse only (NOT PointerSensor — pointer events also fire for touch and would
    // hijack the touch gesture at 5px, defeating the long-press below). Small
    // threshold so a click still opens a card.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Touch: press-and-hold ~0.5s to drag. Moving before then aborts activation so
    // the browser scrolls the column / swipes between columns instead.
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (loadingRef.current) return; // never overlap loads
    loadingRef.current = true;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [{ columns: cols }, { cards }] = await Promise.all([
        api.getProject(projectId),
        api.listCards(projectId),
      ]);
      const byId: Record<string, CardDto> = {};
      const byCol: Record<string, string[]> = {};
      for (const c of cols) byCol[c.id] = [];
      const sorted = [...cards].sort((a, b) => a.position - b.position);
      for (const card of sorted) {
        byId[card.id] = card;
        (byCol[card.columnId] ??= []).push(card.id);
      }
      setColumns(cols);
      setItems(byCol);
      setCardsById(byId);
    } catch (err) {
      // Stay quiet on background refresh failures; only surface on explicit load.
      if (!opts?.silent) setError(err instanceof Error ? err.message : 'Failed to load board');
    } finally {
      loadingRef.current = false;
      if (!opts?.silent) setLoading(false);
    }
  }, [projectId]);

  // Reload on mount, on project change, and when the parent bumps reloadNonce
  // (e.g. after project settings change the columns).
  useEffect(() => { void load(); }, [load, reloadNonce]);

  // Auto-refresh the open board every 20s while the tab is visible, and the
  // moment it regains focus — so agents'/others' changes appear without a
  // manual reload. Skipped mid-drag so it can't clobber an in-flight move.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (draggingRef.current) return;
      void load({ silent: true });
    };
    const interval = window.setInterval(refresh, 20_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  // Deep-link from a notification: once the target card is loaded, open it and
  // hand its location to the modal to scroll/flash. Consume the nav so it fires once.
  useEffect(() => {
    if (!nav) return;
    const card = cardsById[nav.cardId];
    if (!card) return;
    setModal({ mode: 'view', card });
    setScrollTo(nav.source);
    onNavHandled?.();
  }, [nav, cardsById, onNavHandled]);

  const findContainer = (id: string): string | undefined => {
    if (id in items) return id; // dropped on a column body
    return Object.keys(items).find((col) => items[col]!.includes(id));
  };

  function onDragStart(e: DragStartEvent) {
    setError(null);
    draggingRef.current = true;
    setActiveId(String(e.active.id));
  }

  function onDragCancel() {
    draggingRef.current = false;
    setActiveId(null);
  }

  function onDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(active);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    // Move the dragged id into the target column (visual, mid-drag). The
    // DragOverlay renders the pointer-following card, so relocating the real
    // node between columns here is safe — nothing tracked unmounts.
    setItems((prev) => {
      const fromList = (prev[from] ?? []).filter((x) => x !== active);
      const toList = [...(prev[to] ?? [])];
      if (toList.includes(active)) return prev;
      const overIndex = overId === to ? toList.length : toList.indexOf(overId);
      toList.splice(overIndex < 0 ? toList.length : overIndex, 0, active);
      return { ...prev, [from]: fromList, [to]: toList };
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    draggingRef.current = false;
    setActiveId(null);
    const active = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const to = findContainer(active);
    const moved = cardsById[active];
    if (!overId || !to || !moved) return;

    // Reorder within the target column if dropped over a sibling card.
    let list = items[to] ?? [];
    if (overId !== to && overId !== active) {
      const fromIdx = list.indexOf(active);
      const overIdx = list.indexOf(overId);
      if (fromIdx !== -1 && overIdx !== -1 && fromIdx !== overIdx) {
        list = arrayMove(list, fromIdx, overIdx);
        setItems((prev) => ({ ...prev, [to]: list }));
      }
    }

    // Compute the card's new fractional position from its neighbors.
    const idx = list.indexOf(active);
    const prevCard = idx > 0 ? cardsById[list[idx - 1]!] : undefined;
    const nextCard = idx >= 0 && idx < list.length - 1 ? cardsById[list[idx + 1]!] : undefined;
    const position = rankBetween(prevCard?.position ?? null, nextCard?.position ?? null);

    // No-op if nothing actually changed.
    if (moved.columnId === to && moved.position === position) return;

    // Optimistic local update.
    setCardsById((prev) => ({ ...prev, [active]: { ...moved, columnId: to, position } }));
    try {
      await api.patchCard(active, { columnId: to, position });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move failed');
      void load(); // reconcile from server on failure
    }
  }

  async function saveCard(input: CardInput): Promise<CardDto> {
    if (modal?.mode === 'view') {
      // Existing card: persist, refresh the open modal with the saved card,
      // and reconcile the board behind it. Modal stays open (returns to view).
      const { card } = await api.patchCard(modal.card.id, input);
      setModal({ mode: 'view', card });
      // SILENT reload: a non-silent load() flips `loading`, and Board's
      // `if (loading) return <spinner>` would unmount the open modal (and the
      // in-flight attach that adopted this card) — remounting it fresh in view
      // mode, dropping the upload's description embed + list (KBR-38).
      await load({ silent: true });
      return card;
    }
    // Create: persist, then ADOPT the new card into the modal so it can carry
    // attachments / further edits — instead of forcing a close+reopen. Reload
    // SILENTLY so the board spinner can't unmount the modal mid-attach (KBR-38).
    const { card } = await api.createCard(projectId, input);
    setModal({ mode: 'view', card });
    await load({ silent: true });
    return card;
  }

  async function deleteCard() {
    if (modal?.mode !== 'view') return;
    await api.deleteCard(modal.card.id);
    await load();
  }

  async function renameColumn(col: ColumnDto) {
    const name = await dialog.prompt({ title: 'Rename column', label: 'Column name', defaultValue: col.name });
    if (!name || name === col.name) return;
    await api.patchColumn(col.id, { name });
    await load();
  }

  async function setColumnRole(col: ColumnDto, role: ColumnRole | null) {
    if (col.role === role) return;
    // The API enforces one-lane-per-role: setting a role yanks it off any other
    // lane. Optimistically clear the old holder here so the badge moves at once.
    setColumns((prev) => prev.map((c) => {
      if (c.id === col.id) return { ...c, role };
      if (role && c.role === role) return { ...c, role: null };
      return c;
    }));
    try {
      await api.patchColumn(col.id, { role });
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set role');
      void load();
    }
  }

  // Done-column hygiene (KBR-60): archive every card in the lane after a
  // type-nothing confirm that shows the count. History survives; restore lives
  // in Project Settings → Archive.
  async function archiveAll(col: ColumnDto) {
    const list = (items[col.id] ?? []).map((id) => cardsById[id]!).filter(Boolean);
    if (list.length === 0) return;
    const ok = await dialog.confirm({
      title: `Archive all ${list.length} card${list.length === 1 ? '' : 's'} in “${col.name}”?`,
      message: 'They leave the board but keep their timeline and attachments. Restore any time from Project Settings → Archive.',
      confirmLabel: `Archive ${list.length}`,
    });
    if (!ok) return;
    try {
      await Promise.all(list.map((c) => api.patchCard(c.id, { archived: true })));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive failed');
      void load();
    }
  }

  async function deleteColumn(col: ColumnDto) {
    const ok = await dialog.confirm({
      title: 'Delete column?',
      message: `“${col.name}” will be removed. This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteColumn(col.id);
      await load();
    } catch (err) {
      await dialog.alert({ title: "Couldn't delete column", message: err instanceof Error ? err.message : 'Delete failed' });
    }
  }

  if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

  const activeCard = activeId ? cardsById[activeId] : null;

  return (
    <>
      {error && <div className="error-text" style={{ padding: '0.5rem 1.25rem 0' }}>{error}</div>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        // Gentle, edge-only auto-scroll: default acceleration (10) rockets the
        // board to the last column on a slight sideways nudge on mobile. Lower it
        // and only trigger near the very horizontal edges.
        autoScroll={{ acceleration: 3, threshold: { x: 0.1, y: 0.36 } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className={`board ${activeId ? 'dragging' : ''}`}>
          {columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              cards={(items[col.id] ?? []).map((id) => cardsById[id]!).filter(Boolean).filter((c) => cardMatchesFilter(c, filter))}
              users={users}
              onAddCard={(columnId) => { setScrollTo(undefined); setModal({ mode: 'create', columnId }); }}
              onOpenCard={(card) => { setScrollTo(undefined); setModal({ mode: 'view', card }); }}
              onRename={renameColumn}
              onDelete={deleteColumn}
              onSetRole={setColumnRole}
              onArchiveAll={col.role === 'done' ? () => void archiveAll(col) : undefined}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeCard ? <CardBody card={activeCard} users={users} className="overlay" /> : null}
        </DragOverlay>
      </DndContext>

      {modal && (
        <CardModal
          card={modal.mode === 'view' ? modal.card : undefined}
          createInColumnId={modal.mode === 'create' ? modal.columnId : undefined}
          columns={columns}
          users={users}
          meId={meId}
          projectLabels={projectLabels}
          scrollTo={modal.mode === 'view' ? scrollTo : undefined}
          onSave={saveCard}
          onDelete={modal.mode === 'view' ? deleteCard : undefined}
          onClose={() => { setModal(null); setScrollTo(undefined); }}
        />
      )}
    </>
  );
}
