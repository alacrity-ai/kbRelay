import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import type { CardDto, ColumnDto, UserDto, AttachmentDto } from '@kbrelay/shared';
import Board from './Board';
import { DialogProvider } from './Dialog';

// Mock the API so we control create/upload/refresh timing. KBR-38 is a
// mount-lifecycle bug in the create→adopt path, so we drive the REAL Board
// end-to-end and mirror prod faithfully (fresh arrays per load, realistic
// delays, and the window-focus reload the native file picker triggers).
vi.mock('../lib/api', () => ({
  getProject: vi.fn(),
  listCards: vi.fn(),
  createCard: vi.fn(),
  patchCard: vi.fn(),
  deleteCard: vi.fn(),
  getCard: vi.fn(),
  uploadAttachment: vi.fn(),
  getTimeline: vi.fn(async () => ({ events: [] })),
  patchColumn: vi.fn(),
  deleteColumn: vi.fn(),
  attachmentBlobUrl: (id: string) => `/api/v1/attachments/${id}/blob`,
  deleteAttachment: vi.fn(),
}));
import * as api from '../lib/api';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// FRESH arrays each call — mirrors real load(). (Reusing one reference makes
// setColumns a no-op, which hid the remount in an earlier version of this test.)
const freshColumns = (): ColumnDto[] => [
  { id: 'col1', projectId: 'p1', name: 'Todo', color: null, position: 0, role: 'ready', createdAt: 0 },
];
const users: UserDto[] = [
  { id: 'u1', name: 'Leif', kind: 'human', role: 'admin', color: '#000', handle: 'leif' } as UserDto,
];
const attachment = (over: Partial<AttachmentDto>): AttachmentDto => ({
  id: 'att1', cardId: 'card_new', eventId: null, filename: 'file.bin',
  contentType: 'application/octet-stream', sizeBytes: 1234, kind: 'misc',
  createdBy: 'u1', createdAt: 0, ...over,
} as AttachmentDto);
const savedCard = (): CardDto => ({
  id: 'card_new', projectId: 'p1', columnId: 'col1', key: 'KBR-99', seq: 99,
  summary: 'My card', description: 'Hello', acceptanceCriteria: null, color: null,
  position: 1000, assigneeUserId: null, reviewerUserId: null, dueAt: null, createdBy: 'u1', updatedBy: 'u1',
  createdAt: 0, updatedAt: 1, attachments: [],
} as CardDto);

// The summary input exists ONLY in edit mode — a reliable edit/view detector
// (a bare textarea query is a false positive: view mode has a Timeline composer).
const inEditMode = () => !!document.querySelector('.modal-title-input');
const descTextarea = () => document.querySelectorAll('textarea')[0] as HTMLTextAreaElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  let cards: CardDto[] = [];
  mock(api.getProject).mockImplementation(async () => { await delay(20); return { project: { id: 'p1', name: 'P', code: 'P' }, columns: freshColumns() }; });
  mock(api.listCards).mockImplementation(async () => { await delay(20); return { cards: [...cards] }; });
  mock(api.createCard).mockImplementation(async () => { await delay(40); cards = [savedCard()]; return { card: savedCard() }; });
  // Post-adopt refresh is slower than the upload and returns an empty list
  // (server hasn't seen the upload yet) — must not clobber the optimistic add.
  mock(api.getCard).mockImplementation(async () => { await delay(60); return { card: { ...savedCard(), attachments: [] } }; });
});

async function newCardAttach(file: File, uploaded: AttachmentDto) {
  mock(api.uploadAttachment).mockImplementation(async () => { await delay(30); return uploaded; });
  render(<DialogProvider><Board projectId="p1" users={users} meId="u1" /></DialogProvider>);
  fireEvent.click(await screen.findByText('+ Add card'));
  fireEvent.change(document.querySelector('.modal-title-input') as HTMLInputElement, { target: { value: 'My card' } });
  fireEvent.change(descTextarea()!, { target: { value: 'Hello' } });
  // Native picker close → window regains focus → Board's focus listener fires a
  // concurrent load(). Include it so the test matches the real environment.
  await act(async () => {
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
    window.dispatchEvent(new Event('focus'));
  });
  fireEvent.click(await screen.findByText('Save & attach'));
  await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalled(), { timeout: 3000 });
  await act(async () => { await delay(300); }); // let create, both loads, upload + refresh settle
}

describe('KBR-38: attach to a brand-new card (does not remount the modal)', () => {
  it('IMAGE: stays in edit, embeds the image, shows it in the list', async () => {
    const img = attachment({ id: 'att_img', filename: 'cat.jpg', contentType: 'image/jpeg', kind: 'image' });
    await newCardAttach(new File(['x'], 'cat.jpg', { type: 'image/jpeg' }), img);

    // (1) NOT booted to view — the edit form is still mounted.
    expect(inEditMode()).toBe(true);
    // (2) Image markdown embedded in the description we're editing.
    expect(descTextarea()!.value).toContain('![cat.jpg](/api/v1/attachments/att_img/blob)');
    // (3) Attachment visible right away (edit-mode list), not only after reopen.
    expect(screen.getByText('cat.jpg')).toBeTruthy();
  });

  it('NON-IMAGE: stays in edit, links the file, shows it in the list', async () => {
    const zip = attachment({ id: 'att_zip', filename: 'archive.zip', contentType: 'application/zip', kind: 'archive' });
    await newCardAttach(new File(['x'], 'archive.zip', { type: 'application/zip' }), zip);

    expect(inEditMode()).toBe(true);
    expect(descTextarea()!.value).toContain('[📎 archive.zip](/api/v1/attachments/att_zip/blob)');
    expect(screen.getByText('archive.zip')).toBeTruthy();
  });

  it('the just-attached file survives the slow, stale post-adopt refresh', async () => {
    const img = attachment({ id: 'att_img', filename: 'cat.jpg', contentType: 'image/jpeg', kind: 'image' });
    await newCardAttach(new File(['x'], 'cat.jpg', { type: 'image/jpeg' }), img);
    await act(async () => { await delay(200); }); // any late empty getCard resolves here
    expect(screen.getByText('cat.jpg')).toBeTruthy();
  });
});

describe('KBR-38: view mode is read-only for attachments', () => {
  it('shows attachments without a remove (✕) control in view mode', async () => {
    const img = attachment({ id: 'att_img', filename: 'cat.jpg', contentType: 'image/jpeg', kind: 'image' });
    mock(api.getCard).mockImplementation(async () => { await delay(20); return { card: { ...savedCard(), attachments: [img] } }; });
    const withAttach = { ...savedCard(), attachmentCounts: { total: 1, image: 1 } } as unknown as CardDto;
    mock(api.listCards).mockImplementation(async () => { await delay(20); return { cards: [withAttach] }; });

    render(<DialogProvider><Board projectId="p1" users={users} meId="u1" /></DialogProvider>);
    fireEvent.click(await screen.findByText('My card')); // opens existing card → view mode
    await waitFor(() => expect(screen.getByText('cat.jpg')).toBeTruthy(), { timeout: 2000 });
    expect(inEditMode()).toBe(false);
    expect(screen.queryByLabelText('Remove cat.jpg')).toBeNull();
  });
});
