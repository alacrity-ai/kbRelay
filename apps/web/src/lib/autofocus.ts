/**
 * Whether to auto-focus a search/text input when a panel opens. Auto-focusing
 * pops the on-screen keyboard on touch devices (mobile), which blocks scrolling
 * and is jarring (KBR-32). Only auto-focus when the primary pointer is fine
 * (a mouse — i.e. desktop). Falls back to true if matchMedia is unavailable.
 */
export function shouldAutofocusInput(): boolean {
  try {
    return window.matchMedia('(pointer: fine)').matches;
  } catch {
    return true;
  }
}
