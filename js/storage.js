// Remembers the scenario document in the visitor's own browser (localStorage).
// Storage can be unavailable (private browsing, blocked site data): every access is
// guarded and the page then simply works without remembering anything.

const KEY = 'consultingBudgetCalculator';

export function loadStored() {
  try {
    const text = localStorage.getItem(KEY);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function saveStored(doc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function clearStored() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

// Small page preferences (selected part, mode, closed help box), separate from the data.
const PREFS_KEY = 'consultingBudgetCalculator.ui';

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // not remembered
  }
}

export function clearPrefs() {
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    // nothing to clear
  }
}
