import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, Eye, Flag, Medal, Share2, Trophy, Users, X } from 'lucide-react'
import { createDoubleTournament, getAllMatches, getMatch, getPlacements, getWinnerForScore, needsFinalReset, participantName, playedDependentMatches, resolveMatchPlayers, roundLabel, setMatchResult } from '../lib/bracket'
import { createShareUrl } from '../lib/share'
import type { Match, Score, Tournament } from '../types'
import { ConfirmDialog, ResultSheet, ShareDialog } from './Dialogs'
import { MatchCard } from './MatchCard'

interface TournamentScreenProps {
  tournament: Tournament
  readOnly: boolean
  onChange: (tournament: Tournament) => void
  onRestore: () => void
}
interface PendingResult { matchId: string; score: Exclude<Score, 'bye'>; tiebreakWinnerId?: string; dependentCount: number }
type Branch = 'upper' | 'lower' | 'final'
const WIDTH = 360
const HEIGHT = 344
const GAP = 64
const ROW = 380
const HEADER = 80

function Podium({ tournament }: { tournament: Tournament }) {
  const places = getPlacements(tournament)
  if (!places.champion) return null
  return <section className="champion-banner" aria-label="Итоги турнира">
    <div className="champion-icon"><Trophy size={28} /></div>
    <div className="min-w-0 flex-1"><div className="eyebrow !text-mint">Чемпион определён</div>
      <h2 className="mt-2 break-words text-2xl font-black text-white">{participantName(tournament, places.champion)}</h2>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <span className="podium-chip"><Medal size={16} />2-е: {participantName(tournament, places.runnerUp)}</span>
        {places.third && <span className="podium-chip"><Medal size={16} />3-е: {participantName(tournament, places.third)}</span>}
      </div>
    </div>
  </section>
}

function bracketLabel(round: number, rounds: Match[][], branch: Branch, double: boolean) {
  if (branch === 'final') return round === 0 ? 'Общий финал' : 'Решающий матч'
  if (branch === 'lower') return round === rounds.length - 1 ? 'Финал нижней' : `Раунд ${round + 1}`
  if (double) return round === rounds.length - 1 ? 'Финал верхней' : `Раунд ${round + 1}`
  return roundLabel(round, rounds.length)
}

interface BracketProps {
  tournament: Tournament; rounds: Match[][]; branch: Branch
  onOpen: (match: Match) => void; highlightedPlayer: string
}

function Bracket({ tournament, rounds, branch, onOpen, highlightedPlayer }: BracketProps) {
  const [activeRound, setActiveRound] = useState(0)
  const isDouble = tournament.format === 'double'
  const label = (index: number) => bracketLabel(index, rounds, branch, isDouble)
  const width = rounds.length * WIDTH + Math.max(0, rounds.length - 1) * GAP
  const laneHeight = Math.max(...rounds.map((r) => r.length), 1) * ROW
  const center = (r: number, pos: number) => HEADER + (pos + .5) * laneHeight / rounds[r].length
  const locations = new Map(rounds.flatMap((round, r) => round.map((match) => [match.id, { r, pos: match.position }] as const)))
  return <>
    <div className="lg:hidden">
      <div className="round-tabs" role="tablist" aria-label="Раунды">
        {rounds.map((round, index) => <button key={index} role="tab" type="button" aria-selected={activeRound === index} className={`round-tab ${activeRound === index ? 'active' : ''}`} onClick={() => setActiveRound(index)}>
          {label(index)} <span className="tab-count">{round.filter((m) => m.result).length}/{round.length}</span>
        </button>)}
      </div>
      <div role="tabpanel" className="mobile-matches">
        <div className="round-caption"><h3>{label(activeRound)}</h3><span>Матчей: {rounds[activeRound]?.length ?? 0}</span></div>
        {rounds[activeRound]?.map((match) => <MatchCard key={match.id} tournament={tournament} match={match} onOpen={onOpen} highlightedPlayer={highlightedPlayer} />)}
      </div>
    </div>
    <div className="desktop-bracket hidden lg:block" tabIndex={0} role="region" aria-label="Сетка с переходами. Прокрутите вправо для следующих раундов.">
      <div className="bracket-canvas" style={{ width, height: HEADER + laneHeight }}>
        <svg className="bracket-lines" width={width} height={HEADER + laneHeight} aria-hidden="true">
          {rounds.flatMap((round, r) => round.flatMap((match) => match.sources.map((source, index) => {
            if (source.kind !== 'match') return null
            const from = locations.get(source.matchId)
            if (!from) return null
            const sourceMatch = getMatch(tournament, source.matchId)!
            const x1 = from.r * (WIDTH + GAP) + WIDTH
            const x2 = r * (WIDTH + GAP)
            const y1 = center(from.r, from.pos)
            const y2 = center(r, match.position)
            const hot = Boolean(highlightedPlayer && resolveMatchPlayers(tournament, match).includes(highlightedPlayer) && sourceMatch.result?.winnerId === highlightedPlayer)
            return <path className={`${sourceMatch.result ? 'resolved' : ''} ${hot ? 'highlighted' : ''}`} key={`${match.id}-${index}`} d={`M ${x1} ${y1} H ${x2 - GAP / 2} V ${y2} H ${x2}`} />
          })))}
        </svg>
        {rounds.map((round, r) => <div key={r}>
          <div className="round-heading" style={{ left: r * (WIDTH + GAP), width: WIDTH }}><span>{label(r)}</span><small>{round.filter((m) => m.result).length}/{round.length} готово</small></div>
          {round.map((match) => <div key={match.id} className="absolute" style={{ left: r * (WIDTH + GAP), top: center(r, match.position) - HEIGHT / 2, width: WIDTH, height: HEIGHT }}>
            <MatchCard tournament={tournament} match={match} onOpen={onOpen} highlightedPlayer={highlightedPlayer} desktop />
          </div>)}
        </div>)}
      </div>
    </div>
  </>
}

export function TournamentScreen({ tournament, readOnly, onChange, onRestore }: TournamentScreenProps) {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [pendingResult, setPendingResult] = useState<PendingResult | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [rebuildOpen, setRebuildOpen] = useState(false)
  const [branch, setBranch] = useState<Branch>('upper')
  const [highlightedPlayer, setHighlightedPlayer] = useState('')
  const shareUrl = useMemo(() => createShareUrl(tournament), [tournament])
  const selectedMatch = selectedMatchId ? getMatch(tournament, selectedMatchId) : undefined
  const isDouble = tournament.format === 'double'
  const allMatches = getAllMatches(tournament)
  const matches = allMatches.filter((m) => m.result?.score !== 'bye' && (m.id !== tournament.resetFinal?.id || needsFinalReset(tournament)))
  const completed = matches.filter((m) => m.result).length
  const ready = matches.filter((m) => !m.result && resolveMatchPlayers(tournament, m).every(Boolean)).length
  const rounds = branch === 'upper' ? tournament.rounds : branch === 'lower' ? tournament.lowerRounds ?? [] : [tournament.grandFinal ? [tournament.grandFinal] : [], ...(tournament.resetFinal && needsFinalReset(tournament) ? [[tournament.resetFinal]] : [])]
  const losses = highlightedPlayer ? allMatches.filter((m) => m.result && m.result.score !== 'bye' && m.result.winnerId !== highlightedPlayer && resolveMatchPlayers(tournament, m).includes(highlightedPlayer)).length : 0

  const applyResult = (matchId: string, score: Exclude<Score, 'bye'>, tiebreakWinnerId?: string) => {
    onChange(setMatchResult(tournament, matchId, score, tiebreakWinnerId))
    setSelectedMatchId(null)
  }
  const requestResult = (score: Exclude<Score, 'bye'>, tiebreakWinnerId?: string) => {
    if (!selectedMatch || readOnly) return
    const newWinner = getWinnerForScore(resolveMatchPlayers(tournament, selectedMatch), score, tiebreakWinnerId)
    const dependents = selectedMatch.result && selectedMatch.result.winnerId !== newWinner ? playedDependentMatches(tournament, selectedMatch.id) : []
    if (dependents.length) {
      setPendingResult({ matchId: selectedMatch.id, score, tiebreakWinnerId, dependentCount: dependents.length })
      setSelectedMatchId(null)
    } else applyResult(selectedMatch.id, score, tiebreakWinnerId)
  }
  const openMatch = (match: Match) => setSelectedMatchId(match.id)

  return <main className="tournament-page">
    {readOnly && <div className="viewer-banner mb-5"><Eye size={18} /><span className="min-w-0 flex-1"><strong>Просмотр по ссылке.</strong> Снимок на момент отправки.</span><button className="viewer-action" onClick={onRestore}>Восстановить</button></div>}
    <section className="tournament-hero">
      <div className="hero-heading"><div className="eyebrow">Шахматы / Турнирная сетка</div><h1>{tournament.name}</h1><p>{isDouble ? 'Два шанса. Один чемпион.' : 'Каждая победа приближает к финалу.'}</p></div>
      <button className="btn-primary" aria-label="Поделиться" onClick={() => setShareOpen(true)}><Share2 size={17} /><span>Поделиться</span></button>
      <div className="tournament-stats">
        <div><Users size={17} /><strong>{tournament.participants.length}</strong><span>участников</span></div>
        <div><Check size={17} /><strong>{completed}</strong><span>матчей сыграно</span></div>
        <div><Flag size={17} /><strong>{ready}</strong><span>готовы к игре</span></div>
      </div>
    </section>
    <Podium tournament={tournament} />
    {!isDouble && !readOnly && <div className="legacy-format"><span>Это сохранённый турнир на вылет. Можно построить для этих игроков новую сетку до двух поражений.</span><button className="btn-secondary" onClick={() => setRebuildOpen(true)}>Перестроить сетку</button></div>}
    {isDouble && <details className="format-disclosure"><summary><span>Как читать сетку</span><small>Два поражения · переходы · финал</small></summary><section className="format-guide" aria-label="Как устроен турнир">
      <div><span className="guide-icon upper"><ArrowUpRight size={20} /></span><span><strong>Побеждаете — идёте выше</strong><small>Верхняя сетка · ни одного поражения</small></span></div>
      <ArrowRight className="guide-arrow" size={18} />
      <div><span className="guide-icon lower"><ArrowDownRight size={20} /></span><span><strong>Проиграли — второй шанс</strong><small>Нижняя сетка · ещё одно поражение — вылет</small></span></div>
      <ArrowRight className="guide-arrow" size={18} />
      <div><span className="guide-icon final"><Trophy size={20} /></span><span><strong>Встреча победителей</strong><small>Общий финал · борьба за чемпионство</small></span></div>
    </section></details>}
    <section className={`bracket-workspace branch-${branch}`} aria-label="Турнирная сетка">
      <div className="workspace-toolbar">
        <div className="branch-tabs" role="tablist" aria-label="Ветки турнира">
          <button role="tab" aria-selected={branch === 'upper'} className={branch === 'upper' ? 'active' : ''} onClick={() => setBranch('upper')}><ArrowUpRight size={17} />{isDouble ? 'Верхняя' : 'Сетка'}<span>01</span></button>
          {isDouble && <><button role="tab" aria-selected={branch === 'lower'} className={branch === 'lower' ? 'active lower' : ''} onClick={() => setBranch('lower')}><ArrowDownRight size={17} />Нижняя<span>02</span></button><button role="tab" aria-selected={branch === 'final'} className={branch === 'final' ? 'active final' : ''} onClick={() => setBranch('final')}><Trophy size={16} />Финал<span>03</span></button></>}
        </div>
        <label className="player-filter"><span>Путь игрока</span><select aria-label="Подсветить путь игрока" value={highlightedPlayer} onChange={(e) => setHighlightedPlayer(e.target.value)}><option value="">Все участники</option>{tournament.participants.map((p, index) => <option key={p.id} value={p.id}>#{index + 1} · {p.name}</option>)}</select></label>
      </div>
      <div className="branch-intro"><div><h2>{branch === 'upper' ? isDouble ? 'Путь без поражений' : 'Путь к чемпионству' : branch === 'lower' ? 'Второй шанс на победу' : 'За звание чемпиона'}</h2><p>{branch === 'upper' ? isDouble ? 'Победитель проходит дальше. Проигравший переходит в нижнюю сетку.' : 'Победитель проходит дальше, проигравший выбывает.' : branch === 'lower' ? 'Сюда приходят проигравшие из верхней сетки. Побеждайте, чтобы остаться в турнире.' : 'Если победит финалист нижней сетки, откроется решающий матч: у обоих будет по одному поражению.'}</p></div><span className="direction-hint">Следующие раунды <ArrowRight size={16} /></span></div>
      {highlightedPlayer && <div className="highlight-notice"><span><strong>{participantName(tournament, highlightedPlayer)}</strong> · поражений: {losses}{losses >= (isDouble ? 2 : 1) ? ' · выбыл' : ' · путь подсвечен'}</span><button className="icon-button" aria-label="Убрать подсветку" onClick={() => setHighlightedPlayer('')}><X size={16} /></button></div>}
      <div className="bracket-content" role="tabpanel">
        {rounds.length ? <Bracket key={`${branch}-${rounds.length}`} tournament={tournament} rounds={rounds} branch={branch} highlightedPlayer={highlightedPlayer} onOpen={openMatch} /> : <div className="empty-state">При двух участниках проигравший первого матча сразу выходит в общий финал.</div>}
      </div>
      <div className="bracket-legend"><span><i className="legend-dot winner" />Победитель</span><span><i className="legend-dot loser" />Поражение</span><span><i className="legend-dot waiting" />Ожидание</span><small>Нажмите на матч, чтобы увидеть детали{!readOnly && ' или внести счёт'}.</small></div>
    </section>
    {tournament.thirdPlaceMatch && <section className="legacy-third"><h2>Матч за третье место</h2><MatchCard tournament={tournament} match={tournament.thirdPlaceMatch} onOpen={openMatch} highlightedPlayer={highlightedPlayer} /></section>}
    <footer className="tournament-footer"><span>♞ Шахматная сетка</span><span>{readOnly ? 'Сохранённый снимок турнира' : 'Изменения сохраняются на этом устройстве'}</span></footer>
    {selectedMatch && <ResultSheet tournament={tournament} match={selectedMatch} readOnly={readOnly} onClose={() => setSelectedMatchId(null)} onSubmit={requestResult} />}
    {pendingResult && <ConfirmDialog title="Изменить победителя?" message={`Будут сброшены зависимые результаты в обеих сетках и финале: ${pendingResult.dependentCount}. Остальные матчи сохранятся.`} confirmLabel="Изменить и сбросить" danger onCancel={() => setPendingResult(null)} onConfirm={() => { applyResult(pendingResult.matchId, pendingResult.score, pendingResult.tiebreakWinnerId); setPendingResult(null) }} />}
    {shareOpen && <ShareDialog url={shareUrl} onClose={() => setShareOpen(false)} />}
    {rebuildOpen && <ConfirmDialog title="Перестроить сетку?" message="Название и участники сохранятся. Все прежние результаты будут сброшены: новая сетка строится до двух поражений. Чтобы сохранить старые результаты, сначала отправьте себе ссылку на турнир." confirmLabel="Перестроить" danger onCancel={() => setRebuildOpen(false)} onConfirm={() => { onChange(createDoubleTournament(tournament.name, tournament.participants)); setBranch('upper'); setRebuildOpen(false) }} />}
  </main>
}
