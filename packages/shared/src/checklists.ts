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
