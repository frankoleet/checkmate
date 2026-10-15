import type { StoredAppState } from '../types'

export const STORAGE_KEY = 'chess-knockout-state-v1'
export const THEME_KEY = 'chess-knockout-theme'

export const emptyState: StoredAppState = {
  screen: 'setup',
  draft: { name: '', participants: [], includeThirdPlace: true },
}

export function loadState(): StoredAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState
    const value = JSON.parse(raw) as StoredAppState
    if (!value?.draft || (value.screen !== 'setup' && value.screen !== 'tournament')) return emptyState
    return value
  } catch {
    return emptyState
  }
}

export function saveState(state: StoredAppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}
