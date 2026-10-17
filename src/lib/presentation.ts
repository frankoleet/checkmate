import { getAllMatches, getMatch, needsFinalReset, participantName } from './bracket'
import type { Match, MatchSource, Tournament } from '../types'

export function matchCode(tournament: Tournament, match: Match): string {
  return `Игра №${getAllMatches(tournament).findIndex((item) => item.id === match.id) + 1}`
}

export function matchLocation(tournament: Tournament, match: Match): string {
  if (match.id === tournament.grandFinal?.id) return 'Финал · общий финал'
  if (match.id === tournament.resetFinal?.id) return 'Финал · решающий матч'
  if (match.isThirdPlace) return 'Матч за третье место'
  const lower = tournament.lowerRounds?.some((round) => round.some((item) => item.id === match.id))
  return `${lower ? 'Нижняя сетка' : tournament.format === 'double' ? 'Верхняя сетка' : 'Сетка'} · раунд ${match.round + 1}`
}

export function sourceLocation(tournament: Tournament, source: MatchSource): string {
  const match = source.kind === 'match' ? getMatch(tournament, source.matchId) : undefined
  return match ? matchLocation(tournament, match) : ''
}

export function sourceLabel(tournament: Tournament, source: MatchSource, includeLocation = true): string {
  if (source.kind === 'participant') return source.participantId ? 'Стартовый состав' : 'Без соперника · проход дальше'
  const match = getMatch(tournament, source.matchId)
  return `${source.outcome === 'winner' ? 'Победитель' : 'Проигравший'} ${match ? matchCode(tournament, match).replace('Игра', 'игры') : 'предыдущей игры'}${match && includeLocation ? ` · ${matchLocation(tournament, match)}` : ''}`
}

export function destinationLabel(tournament: Tournament, match: Match, outcome: 'winner' | 'loser'): string {
  if (match.id === tournament.grandFinal?.id) {
    if (needsFinalReset(tournament)) return '→ решающий матч'
    if (match.result) return outcome === 'winner' ? 'Чемпион' : '2-е место'
    return outcome === 'winner' ? 'Титул / ещё матч' : '2-е / ещё матч'
  }
  const destination = getAllMatches(tournament).find((item) => item.sources.some((source) =>
    source.kind === 'match' && source.matchId === match.id && source.outcome === outcome,
  ))
  if (destination) {
    if (destination.id === tournament.grandFinal?.id) return '→ общий финал'
    if (destination.id === tournament.resetFinal?.id) return '→ решающий матч'
    if (destination.isThirdPlace) return '→ игра за 3-е место'
    const destinationIsLower = tournament.lowerRounds?.some((round) => round.some((item) => item.id === destination.id))
    const currentIsLower = tournament.lowerRounds?.some((round) => round.some((item) => item.id === match.id))
    if (destinationIsLower && !currentIsLower) return '→ нижняя сетка'
    return `→ раунд ${destination.round + 1}`
  }
  if (match.isThirdPlace) return outcome === 'winner' ? '3-е место' : '4-е место'
  if (tournament.format !== 'double' && tournament.rounds.at(-1)?.[0].id === match.id) return outcome === 'winner' ? 'Чемпион' : '2-е место'
  if (tournament.lowerRounds?.at(-1)?.[0].id === match.id && outcome === 'loser') return '3-е место'
  if (match.id === tournament.resetFinal?.id) return outcome === 'winner' ? 'Чемпион' : '2-е место'
  return outcome === 'loser' ? 'Выбывает' : 'Победитель ветки'
}

export function playerTitle(tournament: Tournament, match: Match, playerId: string | null, index: number) {
  return playerId ? participantName(tournament, playerId) : sourceLabel(tournament, match.sources[index], false)
}
