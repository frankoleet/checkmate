import { Check, Clock3 } from 'lucide-react'
import { resolveMatchPlayers } from '../lib/bracket'
import { destinationLabel, matchCode, playerTitle, sourceLabel } from '../lib/presentation'
import type { Match, Tournament } from '../types'

interface MatchCardProps {
  tournament: Tournament
  match: Match
  onOpen?: (match: Match) => void
  desktop?: boolean
  highlightedPlayer?: string
}

export function MatchCard({ tournament, match, onOpen, desktop = false, highlightedPlayer }: MatchCardProps) {
  const players = resolveMatchPlayers(tournament, match)
  const ready = Boolean(players[0] && players[1])
  const complete = Boolean(match.result)
  const isBye = match.result?.score === 'bye'
  const highlighted = Boolean(highlightedPlayer && players.includes(highlightedPlayer))
  const status = isBye ? 'Проход без игры' : complete ? match.result?.score === 'draw' ? 'Решён тай-брейком' : 'Завершён' : ready ? 'Можно играть' : 'Ждём результаты'
  const playerScore = (index: number) => !match.result || isBye ? '—' : match.result.score === 'draw' ? '½' : match.result.score === '1-0' ? index === 0 ? '1' : '0' : index === 0 ? '0' : '1'

  return (
    <button type="button"
      data-match-id={match.id}
      className={`match-card ${desktop ? 'match-card-desktop' : ''} ${ready && onOpen ? 'is-clickable' : ''} ${highlighted ? 'player-highlight' : highlightedPlayer ? 'player-dim' : ''}`}
      onClick={() => onOpen?.(match)}
      aria-label={`${matchCode(tournament, match)}. ${playerTitle(tournament, match, players[0], 0)} против ${playerTitle(tournament, match, players[1], 1)}. ${status}. Подробнее`}
    >
      <div className="match-meta"><span className="match-code">{matchCode(tournament, match)}</span><span className={`match-badge ${complete ? 'done' : ready ? 'playable' : ''}`}>{status}</span></div>
      {players.map((playerId, index) => {
        const winner = Boolean(playerId && match.result?.winnerId === playerId)
        const loser = Boolean(playerId && complete && !winner)
        const seed = tournament.participants.findIndex((player) => player.id === playerId) + 1
        return <div className={`player-row ${winner ? 'winner' : ''} ${loser ? 'loser' : ''}`} key={index}>
          <span className={`player-avatar ${!playerId ? 'unknown' : ''}`}>{seed || '?'}</span>
          <span className="player-identity">
            <span className={`player-name ${!playerId ? 'placeholder' : ''}`} title={playerTitle(tournament, match, playerId, index)}>{playerTitle(tournament, match, playerId, index)}</span>
            <span className="player-origin">{winner ? 'Победитель' : loser ? 'Поражение' : playerId ? sourceLabel(tournament, match.sources[index]) : 'Имя появится после игры'}</span>
          </span>
          {winner && <Check size={16} className="winner-check" />}
          <span className="score-chip">{playerScore(index)}</span>
        </div>
      })}
      <div className="match-routes"><span>Победа {destinationLabel(tournament, match, 'winner')}</span><span>Поражение {destinationLabel(tournament, match, 'loser')}</span></div>
      <div className="match-status"><Clock3 size={13} /><span>{ready && onOpen && !isBye ? complete ? 'Открыть матч · изменить результат' : 'Открыть матч · внести результат' : 'Открыть участников и переходы'}</span></div>
    </button>
  )
}
