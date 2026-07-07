/**
 * GFM task-list helpers (v0.17.0, KBR-59). The markdown IS the checklist —
 * no checklist entity, no migration. These pure functions are the single
 * source of truth for what counts as a task item and how a toggle rewrites
 * the source, shared by the web (interactive checkboxes) and the API (the
 * board's N/M progress chip).
 */

/** A GFM task-list line: optional indent, list marker, then `[ ]`/`[x]`/`[X]`. */
const TASK_LINE_RE = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\]\s)/;

/** A fenced-code delimiter line (``` or ~~~, any info string). */
const FENCE_RE = /^\s*(```|~~~)/;

export interface TaskCounts {
  done: number;
  total: number;
}

/**
 * Count task items in a markdown string, skipping fenced code blocks (a
 * `- [ ]` inside ``` is literal text, not a checkbox).
 */
export function countTaskItems(text: string | null | undefined): TaskCounts {
  if (!text) return { done: 0, total: 0 };
  let inFence = false;
  let done = 0;
  let total = 0;
  for (const line of text.split('\n')) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = TASK_LINE_RE.exec(line);
    if (!m) continue;
    total++;
    if (m[2] !== ' ') done++;
  }
  return { done, total };
}

/** Sum counts across a card's checklist-bearing fields. */
export function countCardTasks(
  description: string | null | undefined,
  acceptanceCriteria: string | null | undefined,
): TaskCounts {
  const d = countTaskItems(description);
  const a = countTaskItems(acceptanceCriteria);
  return { done: d.done + a.done, total: d.total + a.total };
}

/**
 * Is this text edit a checkbox-toggle and nothing else? True when both texts
 * have the same lines and every differing line is the same task item with only
 * its `[ ]`/`[x]` slot flipped. The API uses this to log a compact `task`
 * system event instead of an `edited` one, so checkbox clicks don't spam the
 * activity feed (KBR-72).
 */
export function isChecklistOnlyEdit(before: string | null, after: string | null): boolean {
  if (before == null || after == null || before === after) return false;
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length !== b.length) return false;
  let toggled = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x === y) continue;
    if (!TASK_LINE_RE.test(x) || !TASK_LINE_RE.test(y)) return false;
    // Identical once the checkbox slot is neutralized ⇒ only the mark changed.
    if (x.replace(TASK_LINE_RE, '$1·$3') !== y.replace(TASK_LINE_RE, '$1·$3')) return false;
    toggled++;
  }
  return toggled > 0;
}

/**
 * Check every unchecked task item (KBR-110: an Approve review completes the
 * acceptance criteria). Fence-aware like the counters — a `- [ ]` inside a
 * code block is literal text and stays untouched. Returns the rewritten text,
 * or null when there was nothing to check (callers skip the write).
 */
export function checkAllTasks(text: string | null | undefined): string | null {
  if (!text) return null;
  let inFence = false;
  let changed = false;
  const lines = text.split('\n').map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    const m = TASK_LINE_RE.exec(line);
    if (!m || m[2] !== ' ') return line;
    changed = true;
    return line.replace(TASK_LINE_RE, '$1x$3');
  });
  return changed ? lines.join('\n') : null;
}

/**
 * Toggle the task item on a specific source line (1-based, as reported by the
 * markdown parser's node position). Returns the rewritten text, or null if
 * that line is not a task item (stale render, concurrent edit) — callers must
 * treat null as "don't write".
 */
export function toggleTaskAtLine(text: string, line1Based: number): string | null {
  const lines = text.split('\n');
  const idx = line1Based - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const m = TASK_LINE_RE.exec(lines[idx]!);
  if (!m) return null;
  const next = m[2] === ' ' ? 'x' : ' ';
  lines[idx] = lines[idx]!.replace(TASK_LINE_RE, `$1${next}$3`);
  return lines.join('\n');
}
