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
