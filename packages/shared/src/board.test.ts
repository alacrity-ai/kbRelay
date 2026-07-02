import { describe, it, expect } from 'vitest';
import {
  createCardInput,
  patchProjectInput,
  createProjectInput,
  DEFAULT_COLUMNS,
} from './board.ts';

describe('board input schemas', () => {
  it('createProjectInput requires a non-empty name and a valid code', () => {
    expect(createProjectInput.safeParse({ name: 'Growth', code: 'GRW' }).success).toBe(true);
    expect(createProjectInput.safeParse({ name: 'Growth' }).success).toBe(false); // no code
    expect(createProjectInput.safeParse({ name: '', code: 'GRW' }).success).toBe(false);
    expect(createProjectInput.safeParse({ name: 'X', code: 'A' }).success).toBe(false); // too short
    expect(createProjectInput.safeParse({ name: 'X', code: 'TOOLONG' }).success).toBe(false); // too long
    expect(createProjectInput.safeParse({ name: 'X', code: 'AB-1' }).success).toBe(false); // bad chars
  });

  it('createProjectInput uppercases the code', () => {
    const r = createProjectInput.parse({ name: 'Orderbase - Launch', code: 'obl' });
    expect(r.code).toBe('OBL');
  });

  it('createCardInput requires a summary, allows optional fields', () => {
    expect(createCardInput.safeParse({ summary: 'x' }).success).toBe(true);
    expect(
      createCardInput.safeParse({
        summary: 'x',
        description: 'd',
        acceptanceCriteria: 'a',
        columnId: 'col_1',
        assigneeUserId: 'u_1',
        position: 1500,
      }).success,
    ).toBe(true);
    expect(createCardInput.safeParse({ summary: '' }).success).toBe(false);
    expect(createCardInput.safeParse({ description: 'no summary' }).success).toBe(false);
  });

  it('patchProjectInput accepts only valid status values', () => {
    expect(patchProjectInput.safeParse({ status: 'archived' }).success).toBe(true);
    expect(patchProjectInput.safeParse({ status: 'active' }).success).toBe(true);
    expect(patchProjectInput.safeParse({ status: 'deleted' }).success).toBe(false);
  });

  it('DEFAULT_COLUMNS is the ordered six-lane board with roles pre-wired', () => {
    expect(DEFAULT_COLUMNS.map((c) => [c.name, c.role])).toEqual([
      ['Backlog', null],
      ['Blocked', 'blocked'],
      ['Ready', 'ready'],
      ['In Progress', 'in_progress'],
      ['In Review', 'review'],
      ['Done', 'done'],
    ]);
  });
});
