const STORAGE_KEY = "project-command-center:pending-invitation";

/**
 * Signing in navigates away from /invite/:token, so the token is parked here
 * and the "/" resolver sends the user back once they are authenticated.
 */
export function storePendingInvitation(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function getPendingInvitation(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearPendingInvitation(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
