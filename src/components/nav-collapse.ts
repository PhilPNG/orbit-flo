const storageKey = "orbitflo:nav-collapsed";

export function loadNavCollapsed(): boolean {
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function saveNavCollapsed(value: boolean) {
  try {
    if (value) {
      window.localStorage.setItem(storageKey, "1");
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch {
    // Preference persistence is best-effort.
  }
}
