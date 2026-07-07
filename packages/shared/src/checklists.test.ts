import { describe, it, expect } from 'vitest';
import { countTaskItems, countCardTasks, toggleTaskAtLine, checkAllTasks, isChecklistOnlyEdit } from './checklists';

/** KBR-72: classify checkbox-only edits so they log as quiet `task` events. */
describe('isChecklistOnlyEdit', () => {
  const md = '## AC\n- [ ] first\n- [x] second\nsome prose';

  it('true for a single toggle and for multiple toggles', () => {
    expect(isChecklistOnlyEdit(md, md.replace('- [ ] first', '- [x] first'))).toBe(true);
    const both = md.replace('- [ ] first', '- [x] first').replace('- [x] second', '- [ ] second');
    expect(isChecklistOnlyEdit(md, both)).toBe(true);
  });

  it('false when text changes beyond the checkbox slot', () => {
    expect(isChecklistOnlyEdit(md, md.replace('first', 'FIRST'))).toBe(false);
    expect(isChecklistOnlyEdit(md, md.replace('- [ ] first', '- [x] first!'))).toBe(false);
    expect(isChecklistOnlyEdit(md, md.replace('some prose', 'other prose'))).toBe(false);
  });

  it('false when lines are added/removed, on no-ops, and on nulls', () => {
    expect(isChecklistOnlyEdit(md, `${md}\n- [ ] third`)).toBe(false);
    expect(isChecklistOnlyEdit(md, md)).toBe(false);
    expect(isChecklistOnlyEdit(null, md)).toBe(false);
    expect(isChecklistOnlyEdit(md, null)).toBe(false);
  });

  it('false when a non-task line is what changed', () => {
    expect(isChecklistOnlyEdit('plain [ ] text', 'plain [x] text')).toBe(false);
  });
});

describe('countTaskItems', () => {
  it('counts done/total across -, *, + and ordered markers', () => {
    const md = '- [ ] one\n* [x] two\n+ [X] three\n1. [ ] four\n2) [x] five';
    expect(countTaskItems(md)).toEqual({ done: 3, total: 5 });
  });

  it('counts nested items', () => {
    const md = '- [ ] parent\n  - [x] child\n    - [ ] grandchild';
    expect(countTaskItems(md)).toEqual({ done: 1, total: 3 });
  });

  it('ignores task syntax inside fenced code blocks', () => {
    const md = 'before\n```\n- [ ] not a task\n```\n- [x] real task\n~~~md\n- [ ] also literal\n~~~';
    expect(countTaskItems(md)).toEqual({ done: 1, total: 1 });
  });

  it('ignores plain lists and prose brackets', () => {
    expect(countTaskItems('- plain item\nsee [x] in text\n-[ ] missing space')).toEqual({ done: 0, total: 0 });
    expect(countTaskItems(null)).toEqual({ done: 0, total: 0 });
  });

  it('countCardTasks sums both fields', () => {
    expect(countCardTasks('- [ ] a', '- [x] b\n- [x] c')).toEqual({ done: 2, total: 3 });
  });
});

/** KBR-110: an Approve review completes the acceptance criteria. */
describe('checkAllTasks', () => {
  it('checks every unchecked item across marker styles, keeping the rest intact', () => {
    const md = '# AC\n- [ ] one\n* [x] two\n1. [ ] three\ntext';
    expect(checkAllTasks(md)).toBe('# AC\n- [x] one\n* [x] two\n1. [x] three\ntext');
  });

  it('leaves task syntax inside fenced code blocks alone', () => {
    const md = '- [ ] real\n```\n- [ ] literal\n```\n- [ ] also real';
    expect(checkAllTasks(md)).toBe('- [x] real\n```\n- [ ] literal\n```\n- [x] also real');
  });

  it('returns null when there is nothing to check (no write)', () => {
    expect(checkAllTasks('- [x] done\n* [X] also done')).toBeNull();
    expect(checkAllTasks('no tasks here')).toBeNull();
    expect(checkAllTasks('')).toBeNull();
    expect(checkAllTasks(null)).toBeNull();
    expect(checkAllTasks(undefined)).toBeNull();
  });

  it('is a checklist-only edit (logs as a quiet task event, KBR-72)', () => {
    const md = '- [ ] a\n- [x] b';
    expect(isChecklistOnlyEdit(md, checkAllTasks(md)!)).toBe(true);
  });
});

describe('toggleTaskAtLine', () => {
  const md = '# Title\n- [ ] first\n- [x] second\ntext\n  * [X] nested';

  it('checks an unchecked item (1-based line)', () => {
    expect(toggleTaskAtLine(md, 2)).toBe('# Title\n- [x] first\n- [x] second\ntext\n  * [X] nested');
  });

  it('unchecks a checked item, including uppercase X', () => {
    expect(toggleTaskAtLine(md, 3)).toBe('# Title\n- [ ] first\n- [ ] second\ntext\n  * [X] nested');
    expect(toggleTaskAtLine(md, 5)).toBe('# Title\n- [ ] first\n- [x] second\ntext\n  * [ ] nested');
  });

  it('returns null for non-task lines and out-of-range lines (stale-guard)', () => {
    expect(toggleTaskAtLine(md, 1)).toBeNull();
    expect(toggleTaskAtLine(md, 4)).toBeNull();
    expect(toggleTaskAtLine(md, 99)).toBeNull();
    expect(toggleTaskAtLine(md, 0)).toBeNull();
  });

  it('preserves the rest of the document byte-for-byte', () => {
    const before = '- [ ] a\n\n```\ncode\n```\n- [ ] b';
    const after = toggleTaskAtLine(before, 6)!;
    expect(after).toBe('- [ ] a\n\n```\ncode\n```\n- [x] b');
  });
});
