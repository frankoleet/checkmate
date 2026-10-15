import { describe, expect, it } from 'vitest'
import {
  createTournament,
  getMatch,
  getPlacements,
  playedDependentMatches,
  resolveMatchPlayers,
  setMatchResult,
} from './bracket'
import type { Participant, Tournament } from '../types'

const participants = (count: number): Participant[] =>
  Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Игрок ${index + 1}` }))

function finishTournament(input: Tournament): Tournament {
  let tournament = input
  for (const round of tournament.rounds) {
    for (const original of round) {
      const match = getMatch(tournament, original.id)!
      if (match.result?.score === 'bye') continue
      const players = resolveMatchPlayers(tournament, match)
      expect(players[0]).not.toBeNull()
      expect(players[1]).not.toBeNull()
      tournament = setMatchResult(tournament, match.id, '1-0')
    }
  }
  return tournament
}

describe('олимпийская сетка', () => {
  for (const count of [3, 5, 6, 7, 8, 13, 16]) {
    it(`строит и завершает турнир на ${count} участников`, () => {
      const tournament = createTournament('Тест', participants(count), true, `test-${count}`)
      const bracketSize = 2 ** Math.ceil(Math.log2(count))

      expect(tournament.rounds[0]).toHaveLength(bracketSize / 2)
      expect(tournament.rounds).toHaveLength(Math.log2(bracketSize))

      const byeMatches = tournament.rounds[0].filter((match) => match.result?.score === 'bye')
      expect(byeMatches).toHaveLength(bracketSize - count)
      for (const match of tournament.rounds[0]) {
        expect(resolveMatchPlayers(tournament, match).filter(Boolean).length).toBeGreaterThanOrEqual(1)
      }

      const completed = finishTournament(tournament)
      expect(getPlacements(completed).champion).toBeTruthy()
      expect(tournament.includeThirdPlace).toBe(count >= 4)
    })
  }

  it('требует победителя тай-брейка после ничьей', () => {
    const tournament = createTournament('Ничья', participants(2), false)
    expect(() => setMatchResult(tournament, 'r0-m0', 'draw')).toThrow(/тай-брейка/)

    const completed = setMatchResult(tournament, 'r0-m0', 'draw', 'p2')
    expect(completed.rounds[0][0].result).toEqual({
      score: 'draw',
      winnerId: 'p2',
      tiebreakWinnerId: 'p2',
    })
  })

  it('сбрасывает сыгранный финал при замене победителя полуфинала', () => {
    let tournament = createTournament('Исправление', participants(4), false)
    tournament = setMatchResult(tournament, 'r0-m0', '1-0')
    tournament = setMatchResult(tournament, 'r0-m1', '1-0')
    tournament = setMatchResult(tournament, 'r1-m0', '1-0')

    expect(playedDependentMatches(tournament, 'r0-m0')).toHaveLength(1)
    tournament = setMatchResult(tournament, 'r0-m0', '0-1')

    expect(tournament.rounds[1][0].result).toBeUndefined()
    expect(resolveMatchPlayers(tournament, tournament.rounds[1][0])).toEqual(['p2', 'p3'])
  })

  it('определяет третье место по проигравшим полуфиналов', () => {
    let tournament = createTournament('Призёры', participants(4), true)
    tournament = setMatchResult(tournament, 'r0-m0', '1-0')
    tournament = setMatchResult(tournament, 'r0-m1', '0-1')
    expect(resolveMatchPlayers(tournament, tournament.thirdPlaceMatch!)).toEqual(['p2', 'p3'])

    tournament = setMatchResult(tournament, 'third-place', '0-1')
    tournament = setMatchResult(tournament, 'r1-m0', '1-0')
    expect(getPlacements(tournament)).toEqual({ champion: 'p1', runnerUp: 'p4', third: 'p3' })
  })
})
