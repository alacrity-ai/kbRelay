import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import type { CardDto, ColumnDto, UserDto, AttachmentDto } from '@kbrelay/shared';
import Board from './Board';
import { DialogProvider } from './Dialog';

// Mock the API so we control create/upload/refresh timing. The KBR-38 bug is a
// race in the create→adopt path, so we drive the REAL Board end-to-end.
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

const columns: ColumnDto[] = [
  { id: 'col1', projectId: 'p1', name: 'Todo', color: null, position: 0, role: 'ready', createdAt: 0 },
];
const users: UserDto[] = [
  { id: 'u1', name: 'Leif', kind: 'human', role: 'admin', color: '#000', handle: 'leif' } as UserDto,
];

const IMG: AttachmentDto = {
  id: 'att_img1', cardId: 'card_new', eventId: null, filename: 'cat.jpg',
  contentType: 'image/jpeg', sizeBytes: 1234, kind: 'image', createdBy: 'u1', createdAt: 0,
} as AttachmentDto;

const savedCard: CardDto = {
  id: 'card_new', projectId: 'p1', columnId: 'col1', key: 'KBR-99', seq: 99,
  summary: 'My card', description: 'Hello', // typed text, persisted at create (no embed yet)
  acceptanceCriteria: null, color: null, position: 1000, assigneeUserId: null,
  createdBy: 'u1', updatedBy: 'u1', createdAt: 0, updatedAt: 1, attachments: [],
} as CardDto;

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const descTextarea = () => document.querySelectorAll('textarea')[0] as HTMLTextAreaElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  let cards: CardDto[] = [];
  mock(api.getProject).mockResolvedValue({ project: { id: 'p1', name: 'P', code: 'P' }, columns });
  mock(api.listCards).mockImplementation(async () => ({ cards }));
  mock(api.createCard).mockImplementation(async () => { cards = [savedCard]; return { card: savedCard }; });
  // Upload lands quickly; the post-adopt refresh is SLOW and returns an empty
  // list (server hasn't seen the upload) — the exact race that used to wipe the
  // just-attached file. The fix must let the upload win.
  mock(api.uploadAttachment).mockImplementation(async () => { await delay(10); return IMG; });
  mock(api.getCard).mockImplementation(async () => { await delay(80); return { card: { ...savedCard, attachments: [] } }; });
});

async function openNewCardAndAttach() {
  render(<DialogProvider><Board projectId="p1" users={users} meId="u1" /></DialogProvider>);
  fireEvent.click(await screen.findByText('+ Add card'));
  fireEvent.change(document.querySelector('.modal-title-input') as HTMLInputElement, { target: { value: 'My card' } });
  fireEvent.change(descTextarea()!, { target: { value: 'Hello' } });
  const file = new File(['x'], 'cat.jpg', { type: 'image/jpeg' });
  fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [file] } });
  fireEvent.click(await screen.findByText('Save & attach'));
  await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalled());
}

describe('KBR-38: attach an image to a brand-new card', () => {
  it('stays in edit mode and embeds the image in the description', async () => {
    await openNewCardAndAttach();
    await waitFor(() => expect(descTextarea()).toBeTruthy(), { timeout: 2000 });
    await waitFor(
      () => expect(descTextarea()!.value).toContain('![cat.jpg](/api/v1/attachments/att_img1/blob)'),
      { timeout: 2000 },
    );
  });

  it('shows the attachment in the (edit-mode) list and it survives the slow refresh', async () => {
    await openNewCardAndAttach();
    // Appears immediately in edit mode…
    await waitFor(() => expect(screen.getByText('cat.jpg')).toBeTruthy(), { timeout: 2000 });
    // …and is NOT clobbered when the slow, stale, empty getCard finally resolves.
    await delay(150);
    expect(screen.getByText('cat.jpg')).toBeTruthy();
  });

  it('offers a remove (✕) control in edit mode', async () => {
    await openNewCardAndAttach();
    await waitFor(() => expect(screen.getByText('cat.jpg')).toBeTruthy(), { timeout: 2000 });
    expect(screen.getByLabelText('Remove cat.jpg')).toBeTruthy();
  });

  it('view mode is read-only: no remove (✕) control', async () => {
    // Open an EXISTING card that already has the attachment → view mode.
    mock(api.getCard).mockResolvedValue({ card: { ...savedCard, attachments: [IMG] } });
    const withAttach = { ...savedCard, attachmentCounts: { total: 1, image: 1 } } as unknown as CardDto;
    let cards = [withAttach];
    mock(api.listCards).mockImplementation(async () => ({ cards }));
    render(<DialogProvider><Board projectId="p1" users={users} meId="u1" /></DialogProvider>);
    fireEvent.click(await screen.findByText('My card'));
    await waitFor(() => expect(screen.getByText('cat.jpg')).toBeTruthy(), { timeout: 2000 });
    expect(screen.queryByLabelText('Remove cat.jpg')).toBeNull();
    void cards;
  });
});
