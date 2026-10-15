import type { Match, MatchResult, MatchSource, Participant, Score, Tournament } from '../types'

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const nextPowerOfTwo = (value: number) => {
  let result = 2
  while (result < value) result *= 2
  return result
}

export function createTournament(
  name: string,
  participants: Participant[],
  includeThirdPlace: boolean,
  id = `tournament-${Date.now()}`,
): Tournament {
  if (participants.length < 2) throw new Error('Для турнира нужны минимум два участника')

  const bracketSize = nextPowerOfTwo(participants.length)
  const roundCount = Math.log2(bracketSize)
  const firstRoundMatchCount = bracketSize / 2
  const fullMatches = participants.length - firstRoundMatchCount
  let participantIndex = 0

  const rounds: Match[][] = []
  const firstRound: Match[] = []

  for (let position = 0; position < firstRoundMatchCount; position += 1) {
    const first = participants[participantIndex++]?.id ?? null
    const second = position < fullMatches ? participants[participantIndex++]?.id ?? null : null
    firstRound.push({
      id: `r0-m${position}`,
      round: 0,
      position,
      sources: [
        { kind: 'participant', participantId: first },
        { kind: 'participant', participantId: second },
      ],
    })
  }
  rounds.push(firstRound)

  for (let round = 1; round < roundCount; round += 1) {
    const matchCount = bracketSize / 2 ** (round + 1)
    const matches: Match[] = []
    for (let position = 0; position < matchCount; position += 1) {
      matches.push({
        id: `r${round}-m${position}`,
        round,
        position,
        sources: [
          { kind: 'match', matchId: `r${round - 1}-m${position * 2}`, outcome: 'winner' },
          { kind: 'match', matchId: `r${round - 1}-m${position * 2 + 1}`, outcome: 'winner' },
        ],
      })
    }
    rounds.push(matches)
  }

  const tournament: Tournament = {
    version: 1,
    id,
    name: name.trim(),
    createdAt: new Date().toISOString(),
    participants: clone(participants),
    rounds,
    // При трёх игроках один полуфинал является BYE и второго проигравшего нет.
    includeThirdPlace: includeThirdPlace && participants.length >= 4 && roundCount >= 2,
  }

  if (tournament.includeThirdPlace) {
    const semifinals = rounds[roundCount - 2]
    tournament.thirdPlaceMatch = {
      id: 'third-place',
      round: roundCount,
      position: 0,
      sources: [
        { kind: 'match', matchId: semifinals[0].id, outcome: 'loser' },
        { kind: 'match', matchId: semifinals[1].id, outcome: 'loser' },
      ],
      isThirdPlace: true,
    }
  }

  return applyAutomaticByes(tournament)
}

export function getAllMatches(tournament: Tournament): Match[] {
  return [
    ...tournament.rounds.flat(),
    ...(tournament.lowerRounds?.flat() ?? []),
    ...(tournament.grandFinal ? [tournament.grandFinal] : []),
    ...(tournament.resetFinal ? [tournament.resetFinal] : []),
    ...(tournament.thirdPlaceMatch ? [tournament.thirdPlaceMatch] : []),
  ]
}

export function getMatch(tournament: Tournament, matchId: string): Match | undefined {
  return getAllMatches(tournament).find((match) => match.id === matchId)
}

function getSourceParticipantId(tournament: Tournament, source: MatchSource): string | null {
  if (source.kind === 'participant') return source.participantId
  const sourceMatch = getMatch(tournament, source.matchId)
  if (!sourceMatch?.result) return null
  if (source.outcome === 'winner') return sourceMatch.result.winnerId
  const players = resolveMatchPlayers(tournament, sourceMatch)
  return players.find((id) => id !== null && id !== sourceMatch.result?.winnerId) ?? null
}

export function resolveMatchPlayers(tournament: Tournament, match: Match): [string | null, string | null] {
  if (match.id === tournament.resetFinal?.id && !needsFinalReset(tournament)) return [null, null]
  return [
    getSourceParticipantId(tournament, match.sources[0]),
    getSourceParticipantId(tournament, match.sources[1]),
  ]
}

export function participantName(tournament: Tournament, participantId: string | null): string {
  if (!participantId) return 'Ожидается игрок'
  return tournament.participants.find((participant) => participant.id === participantId)?.name ?? 'Неизвестный игрок'
}

export function sourceResolved(tournament: Tournament, source: MatchSource): boolean {
  if (source.kind === 'participant') return true
  const match = getMatch(tournament, source.matchId)
  return Boolean(match && (match.result || (match.sources.every((item) => sourceResolved(tournament, item)) && resolveMatchPlayers(tournament, match).every((id) => !id))))
}

function applyAutomaticByes(tournament: Tournament): Tournament {
  const next = clone(tournament)
  for (const match of getAllMatches(next)) {
    if (!match.sources.every((source) => sourceResolved(next, source))) continue
    const [first, second] = resolveMatchPlayers(next, match)
    if ((first && !second) || (!first && second)) {
      match.result = { score: 'bye', winnerId: first ?? second! }
    }
  }
  return next
}

export function dependentMatches(tournament: Tournament, matchId: string): Match[] {
  const allMatches = getAllMatches(tournament)
  const found: Match[] = []
  const queue = [matchId]
  const visited = new Set<string>()

  while (queue.length) {
    const current = queue.shift()!
    for (const match of allMatches) {
      if (visited.has(match.id)) continue
      if (match.sources.some((source) => source.kind === 'match' && source.matchId === current)) {
        visited.add(match.id)
        found.push(match)
        queue.push(match.id)
      }
    }
  }
  return found
}

export function playedDependentMatches(tournament: Tournament, matchId: string): Match[] {
  return dependentMatches(tournament, matchId).filter(
    (match) => match.result && match.result.score !== 'bye',
  )
}

export function getWinnerForScore(
  players: [string | null, string | null],
  score: Exclude<Score, 'bye'>,
  tiebreakWinnerId?: string,
): string {
  const [first, second] = players
  if (!first || !second) throw new Error('Оба участника матча ещё не определены')
  if (score === '1-0') return first
  if (score === '0-1') return second
  if (!tiebreakWinnerId || !players.includes(tiebreakWinnerId)) {
    throw new Error('После ничьей нужно выбрать победителя тай-брейка')
  }
  return tiebreakWinnerId
}

export function setMatchResult(
  tournament: Tournament,
  matchId: string,
  score: Exclude<Score, 'bye'>,
  tiebreakWinnerId?: string,
): Tournament {
  const next = clone(tournament)
  const match = getMatch(next, matchId)
  if (!match) throw new Error('Матч не найден')
  const players = resolveMatchPlayers(next, match)
  const winnerId = getWinnerForScore(players, score, tiebreakWinnerId)
  const winnerChanged = Boolean(match.result && match.result.winnerId !== winnerId)

  if (winnerChanged) {
    for (const dependent of dependentMatches(next, matchId)) delete dependent.result
  }

  const result: MatchResult = { score, winnerId }
  if (score === 'draw') result.tiebreakWinnerId = winnerId
  match.result = result
  return applyAutomaticByes(next)
}

/** Compact upper bracket: 20 players play 10 actual opening matches.
 * Every upper loss feeds the lower bracket; each lower loss eliminates.
 * A lower-bracket grand-final win activates the deciding reset final.
 */
export function createDoubleTournament(name: string, participants: Participant[], id = `tournament-${Date.now()}`): Tournament {
  if (participants.length < 2) throw new Error('Для турнира нужны минимум два участника')
  const buildRounds = (initial: MatchSource[], prefix: string): Match[][] => {
    const rounds: Match[][] = []
    let sources = initial
    do {
      const round = rounds.length
      const matches: Match[] = []
      for (let index = 0; index < sources.length; index += 2) {
        matches.push({ id: `${prefix}${round}-m${index / 2}`, round, position: index / 2,
          sources: [sources[index], sources[index + 1] ?? { kind: 'participant', participantId: null }],
        })
      }
      rounds.push(matches)
      sources = matches.map((match) => ({ kind: 'match', matchId: match.id, outcome: 'winner' }))
    } while (sources.length > 1)
    return rounds
  }
  const rounds = buildRounds(participants.map((p) => ({ kind: 'participant', participantId: p.id })), 's')
  const lowerRounds: Match[][] = []
  let survivors: MatchSource[] = []
  const addLowerRound = (sources: MatchSource[]) => {
    if (sources.length === 1) { survivors = sources; return }
    const round = lowerRounds.length
    const matches: Match[] = []
    for (let index = 0; index < sources.length; index += 2) {
      matches.push({ id: `l${round}-m${index / 2}`, round, position: index / 2,
        sources: [sources[index], sources[index + 1] ?? { kind: 'participant', participantId: null }],
      })
    }
    lowerRounds.push(matches)
    survivors = matches.map((match) => ({ kind: 'match', matchId: match.id, outcome: 'winner' }))
  }
  for (const round of rounds) {
    const drops: MatchSource[] = round
      .filter((match) => !match.sources.some((source) => source.kind === 'participant' && !source.participantId))
      .map((match) => ({ kind: 'match', matchId: match.id, outcome: 'loser' }))
    // Cross incoming players to reduce immediate rematches.
    if (survivors.length) drops.reverse()
    const paired: MatchSource[] = []
    for (let i = 0; i < Math.max(survivors.length, drops.length); i++) {
      if (survivors[i]) paired.push(survivors[i])
      if (drops[i]) paired.push(drops[i])
    }
    addLowerRound(paired)
  }
  while (survivors.length > 1) addLowerRound(survivors)
  const tournament: Tournament = {
    version: 1, format: 'double', id, name: name.trim(), createdAt: new Date().toISOString(),
    participants: clone(participants), rounds, lowerRounds, includeThirdPlace: false,
    grandFinal: { id: 'grand-final', round: 0, position: 0, sources: [
      { kind: 'match', matchId: rounds.at(-1)![0].id, outcome: 'winner' }, survivors[0],
    ] },
    resetFinal: { id: 'reset-final', round: 1, position: 0, sources: [
      { kind: 'match', matchId: 'grand-final', outcome: 'winner' },
      { kind: 'match', matchId: 'grand-final', outcome: 'loser' },
    ] },
  }
  return applyAutomaticByes(tournament)
}

export function needsFinalReset(tournament: Tournament): boolean {
  const final = tournament.grandFinal
  return Boolean(final?.result && final.result.winnerId === getSourceParticipantId(tournament, final.sources[1]))
}

export function roundLabel(roundIndex: number, totalRounds: number): string {
  const remaining = totalRounds - roundIndex
  if (remaining === 1) return 'Финал'
  if (remaining === 2) return 'Полуфинал'
  if (remaining === 3) return '1/4 финала'
  if (remaining === 4) return '1/8 финала'
  if (remaining === 5) return '1/16 финала'
  return `Раунд ${roundIndex + 1}`
}

export function scoreLabel(result?: MatchResult): string {
  if (!result) return '—'
  if (result.score === 'draw') return '½–½'
  if (result.score === 'bye') return 'BYE'
  return result.score.replace('-', '–')
}

export function getPlacements(tournament: Tournament): {
  champion: string | null
  runnerUp: string | null
  third: string | null
} {
  const final = tournament.format === 'double'
    ? needsFinalReset(tournament) ? tournament.resetFinal : tournament.grandFinal
    : tournament.rounds.at(-1)?.[0]
  if (!final?.result) return { champion: null, runnerUp: null, third: null }
  const finalPlayers = resolveMatchPlayers(tournament, final)
  const champion = final.result.winnerId
  const runnerUp = finalPlayers.find((id) => id && id !== champion) ?? null
  const lowerFinal = tournament.lowerRounds?.at(-1)?.[0]
  const third = tournament.format === 'double' && lowerFinal?.result
    ? resolveMatchPlayers(tournament, lowerFinal).find((id) => id && id !== lowerFinal.result?.winnerId) ?? null
    : tournament.thirdPlaceMatch?.result?.winnerId ?? null
  return { champion, runnerUp, third }
}

export function isValidTournament(value: unknown): value is Tournament {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Tournament>
  return (
    candidate.version === 1 &&
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.participants) &&
    candidate.participants.length >= 2 &&
    candidate.participants.every(
      (participant) =>
        participant && typeof participant.id === 'string' && typeof participant.name === 'string',
    ) &&
    Array.isArray(candidate.rounds) &&
    candidate.rounds.length >= 1 &&
    candidate.rounds.every((round) => Array.isArray(round) && round.length >= 1)
  )
}
