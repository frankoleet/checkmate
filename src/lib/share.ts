import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { createDoubleTournament, getAllMatches, isValidTournament, setMatchResult } from './bracket'
import type { Score, Tournament } from '../types'

export function encodeTournament(tournament: Tournament): string {
  // The graph is deterministic: transmit players and played results, not repeated edges.
  // Preserve participant IDs so opening a snapshot is an exact round trip.
  if (tournament.format === 'double') {
    const snapshot = {
      kind: 'double-v1', id: tournament.id, name: tournament.name, createdAt: tournament.createdAt,
      players: tournament.participants.map((p) => [p.id, p.name]),
      results: getAllMatches(tournament).flatMap((match, index) => match.result && match.result.score !== 'bye'
        ? [[index, match.result.score, tournament.participants.findIndex((p) => p.id === match.result!.winnerId)]] : []),
    }
    return compressToEncodedURIComponent(JSON.stringify(snapshot))
  }
  return compressToEncodedURIComponent(JSON.stringify(tournament))
}

export function decodeTournament(payload: string): Tournament {
  try {
    const json = decompressFromEncodedURIComponent(payload)
    if (!json) throw new Error()
    const parsed = JSON.parse(json)
    if (parsed?.kind === 'double-v1') {
      if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string' || typeof parsed.createdAt !== 'string' || !Array.isArray(parsed.players) || parsed.players.length < 2 || !Array.isArray(parsed.results)) throw new Error()
      if (!parsed.players.every((p: unknown) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'string' && v.trim()))) throw new Error()
      const participants = (parsed.players as string[][]).map(([id, name]) => ({ id, name }))
      if (new Set(participants.map((p) => p.id)).size !== participants.length) throw new Error()
      let tournament = createDoubleTournament(parsed.name, participants, parsed.id)
      tournament.createdAt = parsed.createdAt
      const matches = getAllMatches(tournament)
      const seen = new Set<number>()
      for (const result of parsed.results) {
        if (!Array.isArray(result) || result.length !== 3) throw new Error()
        const [index, score, winner] = result
        if (!Number.isInteger(index) || !Number.isInteger(winner) || !matches[index] || !participants[winner] || !['1-0', '0-1', 'draw'].includes(score) || seen.has(index)) throw new Error()
        seen.add(index)
        tournament = setMatchResult(tournament, matches[index].id, score as Exclude<Score, 'bye'>, participants[winner].id)
        if (getAllMatches(tournament)[index].result?.winnerId !== participants[winner].id) throw new Error()
      }
      return tournament
    }
    if (!isValidTournament(parsed)) throw new Error()
    return parsed
  } catch {
    throw new Error('Ссылка повреждена или содержит неподдерживаемые данные турнира.')
  }
}

export function createShareUrl(tournament: Tournament): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('view', encodeTournament(tournament))
  return url.toString()
}
