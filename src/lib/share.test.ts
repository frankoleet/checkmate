import { describe, expect, it } from 'vitest'
import { createTournament } from './bracket'
import { createShareUrl, decodeTournament, encodeTournament } from './share'

describe('ссылка на турнир', () => {
  const tournament = createTournament(
    'Кубок со спецсимволами ♞',
    [
      { id: 'one', name: 'Анна' },
      { id: 'two', name: 'Борис' },
      { id: 'three', name: 'Виктор' },
    ],
    true,
    'share-test',
  )

  it('сжимает и восстанавливает полный снимок', () => {
    expect(decodeTournament(encodeTournament(tournament))).toEqual(tournament)
  })

  it('создаёт URL, который можно открыть на другом устройстве', () => {
    const url = new URL(createShareUrl(tournament))
    expect(decodeTournament(url.searchParams.get('view')!)).toEqual(tournament)
  })

  it('показывает понятную ошибку для повреждённой ссылки', () => {
    expect(() => decodeTournament('это-не-снимок')).toThrow(/повреждена/)
  })
})
