import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { AttachmentDto } from '@kbrelay/shared';
import AttachmentList from './AttachmentList';

// The lightbox fetches the image bytes with the bearer token; stub the hook so
// the test exercises the UI, not the network.
vi.mock('../lib/authedBlob', () => ({
  useAuthedObjectUrl: vi.fn(() => ({ objectUrl: 'blob:fake', loading: false, error: false })),
  fetchBlobObjectUrl: vi.fn(),
  isAttachmentUrl: () => false,
}));
vi.mock('../lib/api', () => ({
  attachmentBlobUrl: (id: string, download = false) => `/api/v1/attachments/${id}/blob${download ? '?download=1' : ''}`,
}));

const attachment = (over: Partial<AttachmentDto>): AttachmentDto => ({
  id: 'att1', cardId: 'c1', eventId: null, filename: 'file.bin',
  contentType: 'application/octet-stream', sizeBytes: 1234, kind: 'misc',
  createdBy: 'u1', createdAt: 0, ...over,
} as AttachmentDto);

const image = attachment({ id: 'att_img', filename: 'cat.jpg', contentType: 'image/jpeg', kind: 'image' });
const image2 = attachment({ id: 'att_img2', filename: 'dog.png', contentType: 'image/png', kind: 'image' });
const image3 = attachment({ id: 'att_img3', filename: 'bird.png', contentType: 'image/png', kind: 'image' });
const zip = attachment({ id: 'att_zip', filename: 'a.zip', contentType: 'application/zip', kind: 'archive' });

beforeEach(() => cleanup());

describe('KBR-93: attachment image preview', () => {
  it('shows a Preview button on image rows only', () => {
    render(<AttachmentList items={[image, zip]} />);
    expect(screen.getByLabelText('Preview cat.jpg')).toBeTruthy();
    expect(screen.queryByLabelText('Preview a.zip')).toBeNull();
  });

  it('opens the lightbox with the image, and closes via ✕ / Escape / backdrop', () => {
    render(<AttachmentList items={[image]} />);
    const open = () => fireEvent.click(screen.getByLabelText('Preview cat.jpg'));
    const dialog = () => screen.queryByRole('dialog', { name: 'Preview of cat.jpg' });

    open();
    expect(dialog()).toBeTruthy();
    expect((document.querySelector('.imgprev-img') as HTMLImageElement).src).toContain('blob:');
    fireEvent.click(screen.getByLabelText('Close preview'));
    expect(dialog()).toBeNull();

    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(dialog()).toBeNull();

    open();
    fireEvent.click(screen.getByTestId('imgprev-backdrop'));
    expect(dialog()).toBeNull();
  });

  it('cycles sibling images as a slideshow (arrows + keyboard, wrap-around), skipping non-images', () => {
    render(<AttachmentList items={[image, zip, image2, image3]} />);
    // Open on the SECOND image — the lightbox must start there, counting images only.
    fireEvent.click(screen.getByLabelText('Preview dog.png'));
    expect(screen.getByRole('dialog', { name: 'Preview of dog.png' })).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Next image'));
    expect(screen.getByRole('dialog', { name: 'Preview of bird.png' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next image')); // wraps to the first
    expect(screen.getByRole('dialog', { name: 'Preview of cat.jpg' })).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'ArrowLeft' }); // wraps back to the last
    expect(screen.getByRole('dialog', { name: 'Preview of bird.png' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Preview of cat.jpg' })).toBeTruthy();
  });

  it('cycling resets zoom to 100% for the next image', () => {
    render(<AttachmentList items={[image, image2]} />);
    fireEvent.click(screen.getByLabelText('Preview cat.jpg'));
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('140%')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Next image'));
    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('hides slideshow arrows and counter when there is a single image', () => {
    render(<AttachmentList items={[image, zip]} />);
    fireEvent.click(screen.getByLabelText('Preview cat.jpg'));
    expect(screen.queryByLabelText('Next image')).toBeNull();
    expect(screen.queryByLabelText('Previous image')).toBeNull();
    expect(screen.queryByText('1 / 1')).toBeNull();
  });

  it('zoom buttons change the scale readout; Reset returns to 100%', () => {
    render(<AttachmentList items={[image]} />);
    fireEvent.click(screen.getByLabelText('Preview cat.jpg'));
    expect(screen.getByText('100%')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(screen.getByText('140%')).toBeTruthy();
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByText('100%')).toBeTruthy();
    // Zoom out below 100% is clamped at the floor.
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(screen.getByText('100%')).toBeTruthy();
  });
});
