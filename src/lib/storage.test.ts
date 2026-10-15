import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState, loadState, saveState, STORAGE_KEY } from './storage'

describe('локальное сохранение', () => {
  beforeEach(() => localStorage.clear())

  it('восстанавливает сохранённое состояние после перезагрузки', () => {
    const state = { ...emptyState, draft: { ...emptyState.draft, name: 'Сохранённый кубок' } }
    saveState(state)
    expect(loadState()).toEqual(state)
  })

  it('безопасно игнорирует повреждённые данные', () => {
    localStorage.setItem(STORAGE_KEY, '{broken')
    expect(loadState()).toEqual(emptyState)
  })
})
