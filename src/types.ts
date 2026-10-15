export interface Participant {
  id: string
  name: string
}

export type Score = '1-0' | 'draw' | '0-1' | 'bye'

export interface MatchResult {
  score: Score
  winnerId: string
  tiebreakWinnerId?: string
}

export type MatchSource =
  | { kind: 'participant'; participantId: string | null }
  | { kind: 'match'; matchId: string; outcome: 'winner' | 'loser' }

export interface Match {
  id: string
  round: number
  position: number
  sources: [MatchSource, MatchSource]
  result?: MatchResult
  isThirdPlace?: boolean
}

export interface Tournament {
  version: 1
  format?: 'single' | 'double'
  id: string
  name: string
  createdAt: string
  participants: Participant[]
  rounds: Match[][]
  lowerRounds?: Match[][]
  grandFinal?: Match
  resetFinal?: Match
  includeThirdPlace: boolean
  thirdPlaceMatch?: Match
}

export interface DraftState {
  name: string
  participants: Participant[]
  includeThirdPlace: boolean
}

export interface StoredAppState {
  screen: 'setup' | 'tournament'
  draft: DraftState
  tournament?: Tournament
}
