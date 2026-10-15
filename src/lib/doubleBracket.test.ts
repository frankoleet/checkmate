import { describe, expect, it } from 'vitest'
import { createDoubleTournament, getAllMatches, getMatch, getPlacements, needsFinalReset, playedDependentMatches, resolveMatchPlayers, setMatchResult } from './bracket'
import { decodeTournament, encodeTournament } from './share'
import { loadState, saveState } from './storage'
import type { Tournament } from '../types'

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Игрок ${i + 1}` }))

function play(tournament: Tournament, seed = 0, forceReset = false) {
  let next = tournament
  const losses = new Map(next.participants.map((p) => [p.id, 0]))
  let games = 0
  while (!getPlacements(next).champion && games < 200) {
    const ready = getAllMatches(next).filter((m) => !m.result && resolveMatchPlayers(next, m).every(Boolean))
    expect(ready.length, 'Турнир не должен зависать').toBeGreaterThan(0)
    const match = ready[(games + seed) % ready.length]
    const pair = resolveMatchPlayers(next, match) as [string, string]
    expect(pair[0]).not.toBe(pair[1])
    for (const id of pair) expect(losses.get(id)).toBeLessThan(2)
    if (next.rounds.flat().some((m) => m.id === match.id)) {
      for (const id of pair) expect(losses.get(id)).toBe(0)
    }
    if (next.lowerRounds!.flat().some((m) => m.id === match.id)) {
      for (const id of pair) expect(losses.get(id)).toBe(1)
    }
    if (match.id === 'reset-final') for (const id of pair) expect(losses.get(id)).toBe(1)
    const winner = match.id === 'grand-final' ? forceReset ? 1 : 0 : (games + seed) % 2
    next = games % 3 === 0 ? setMatchResult(next, match.id, 'draw', pair[winner]) : setMatchResult(next, match.id, winner === 0 ? '1-0' : '0-1')
    const loser = pair[1 - winner]
    losses.set(loser, losses.get(loser)! + 1)
    games++
  }
  const champion = getPlacements(next).champion
  expect(champion).toBeTruthy()
  expect(games).toBe(2 * next.participants.length - 2 + Number(forceReset))
  for (const [id, count] of losses) expect(count).toBe(id === champion ? Number(forceReset) : 2)
  return next
}

describe('Два поражения', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8, 13, 16, 20, 21, 32]) {
    for (const reset of [false, true]) {
      it(`${n} участников, ${reset ? 'с решающим матчем' : 'без решающего матча'}`, () => {
        const initial = createDoubleTournament('Кубок', players(n))
        expect(initial.rounds[0].filter((m) => !m.result)).toHaveLength(Math.floor(n / 2))
        for (let seed = 0; seed < 3; seed++) play(initial, seed, reset)
      })
    }
  }

  it('20 игроков играют 10 матчей, десять победителей и десять проигравших расходятся', () => {
    let tournament = createDoubleTournament('20 игроков', players(20))
    expect(tournament.rounds[0]).toHaveLength(10)
    expect(tournament.rounds[0].every((m) => !m.result)).toBe(true)
    for (const match of tournament.rounds[0]) tournament = setMatchResult(tournament, match.id, '1-0')
    const upper = tournament.rounds[1].flatMap((m) => resolveMatchPlayers(tournament, m))
    const lower = tournament.lowerRounds![0].flatMap((m) => resolveMatchPlayers(tournament, m))
    expect(upper).toEqual(players(20).filter((_, i) => i % 2 === 0).map((p) => p.id))
    expect(lower).toEqual(players(20).filter((_, i) => i % 2 === 1).map((p) => p.id))
  })

  it('не даёт ложный BYE, пока второй игрок ждёт результат', () => {
    let tournament = createDoubleTournament('Ожидание', players(5))
    tournament = setMatchResult(tournament, 's0-m0', '1-0')
    expect(getMatch(tournament, 's1-m0')?.result).toBeUndefined()
    expect(getMatch(tournament, 'l0-m0')?.result).toBeUndefined()
  })

  it('исправление первого раунда сбрасывает обе зависимые ветки и финалы', () => {
    let tournament = play(createDoubleTournament('Исправление', players(20)), 1, true)
    const match = tournament.rounds[0][0]
    const pair = resolveMatchPlayers(tournament, match)
    const dependents = playedDependentMatches(tournament, match.id)
    expect(dependents.some((m) => m.id.startsWith('l'))).toBe(true)
    expect(dependents.some((m) => m.id === 'grand-final')).toBe(true)
    expect(dependents.some((m) => m.id === 'reset-final')).toBe(true)
    const untouched = tournament.rounds[0][1].result
    tournament = setMatchResult(tournament, match.id, match.result!.winnerId === pair[0] ? '0-1' : '1-0')
    for (const dependent of dependents) expect(getMatch(tournament, dependent.id)?.result).toBeUndefined()
    expect(tournament.rounds[0][1].result).toEqual(untouched)
    expect(getPlacements(tournament).champion).toBeNull()
  })

  it('финалист верхней сетки может выиграть без решающего матча; смена победителя открывает его', () => {
    let tournament = play(createDoubleTournament('Финал', players(4)))
    expect(needsFinalReset(tournament)).toBe(false)
    expect(() => setMatchResult(tournament, 'reset-final', '1-0')).toThrow()
    tournament = setMatchResult(tournament, 'grand-final', '0-1')
    expect(needsFinalReset(tournament)).toBe(true)
    expect(getPlacements(tournament).champion).toBeNull()
    tournament = setMatchResult(tournament, 'reset-final', '1-0')
    tournament = setMatchResult(tournament, 'grand-final', '1-0')
    expect(needsFinalReset(tournament)).toBe(false)
    expect(tournament.resetFinal?.result).toBeUndefined()
    expect(getPlacements(tournament).champion).toBeTruthy()
  })

  it('снимок и локальное сохранение сохраняют нижнюю сетку и решающий финал', () => {
    const tournament = play(createDoubleTournament('Сохранение', players(20)), 2, true)
    expect(decodeTournament(encodeTournament(tournament))).toEqual(tournament)
    saveState({ screen: 'tournament', tournament, draft: { name: '', participants: [], includeThirdPlace: false } })
    expect(loadState().tournament).toEqual(tournament)
  })
})
