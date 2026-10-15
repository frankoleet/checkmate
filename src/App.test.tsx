import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createTournament } from './lib/bracket'
import { encodeTournament } from './lib/share'

describe('приложение', () => {
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    document.body.innerHTML = '<div id="root"></div>'
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    })
    root = createRoot(document.getElementById('root')!)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('открывает экран создания пустого турнира', async () => {
    await act(async () => root.render(<App />))
    expect(document.body.textContent).toContain('Соберите сетку')
    expect(document.body.textContent).toContain('Пока никого нет')
  })

  it('открывает снимок из ссылки только для просмотра', async () => {
    const tournament = createTournament(
      'Гостевой кубок',
      [
        { id: 'p1', name: 'Анна' },
        { id: 'p2', name: 'Борис' },
      ],
      false,
    )
    const params = new URLSearchParams({ view: encodeTournament(tournament) })
    window.history.replaceState({}, '', `/?${params}`)

    await act(async () => root.render(<App />))
    expect(document.body.textContent).toContain('Гостевой кубок')
    expect(document.body.textContent).toContain('Просмотр по ссылке')
  })
})
