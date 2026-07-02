import { describe, it, expect } from 'vitest';
import { countTaskItems, countCardTasks, toggleTaskAtLine } from './checklists';

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
