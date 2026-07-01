// Token store. The web UI is just an API client that holds a human's
// bearer token in localStorage (see design §5: humans and agents share
// one auth path). No passwords at MVP.
const KEY = 'kbrelay_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
}
