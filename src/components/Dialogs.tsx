import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Link2, RotateCcw, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { participantName, resolveMatchPlayers, scoreLabel } from '../lib/bracket'
import { destinationLabel, matchCode, playerTitle, sourceLabel } from '../lib/presentation'
import type { Match, Score, Tournament } from '../types'

function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const targets = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]') ?? [])
    targets()[0]?.focus({ preventScroll: true })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key === 'Tab') {
        const items = targets()
        const first = items[0]
        const last = items.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
      previousFocus?.focus({ preventScroll: true })
    }
  }, [])
  return ref
}

interface ResultSheetProps {
  tournament: Tournament
  match: Match
  onClose: () => void
  onSubmit: (score: Exclude<Score, 'bye'>, tiebreakWinnerId?: string) => void
  readOnly?: boolean
}

export function ResultSheet({ tournament, match, onClose, onSubmit, readOnly = false }: ResultSheetProps) {
  const players = resolveMatchPlayers(tournament, match)
  const editable = !readOnly && players.every(Boolean) && match.result?.score !== 'bye'
  const [drawMode, setDrawMode] = useState(match.result?.score === 'draw')
  const dialogRef = useDialogFocus(onClose)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="sheet-handle" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">{matchCode(tournament, match)} · {match.isThirdPlace ? 'За третье место' : match.id === tournament.grandFinal?.id ? 'Общий финал' : match.id === tournament.resetFinal?.id ? 'Решающий матч' : 'Карточка матча'}</div>
            <h2 id="result-title" className="text-2xl font-black tracking-tight text-ink dark:text-white">{editable ? 'Кто победил?' : 'Участники и переходы'}</h2>
          </div>
          <button className="icon-button btn-ghost shrink-0" type="button" onClick={onClose} aria-label="Закрыть"><X size={22} /></button>
        </div>

        <div className="versus-card mt-5">
          <div className="min-w-0 flex-1 text-center">
            <span className="mb-1 block text-2xl">♔</span>
            <div className="break-words text-sm font-black text-ink dark:text-white">{playerTitle(tournament, match, players[0], 0)}</div>
            <small className="player-origin mt-2">{sourceLabel(tournament, match.sources[0])}</small>
          </div>
          <div className="rounded-full bg-green/10 px-3 py-1 text-xs font-black text-green dark:bg-mint/10 dark:text-mint">VS</div>
          <div className="min-w-0 flex-1 text-center">
            <span className="mb-1 block text-2xl">♚</span>
            <div className="break-words text-sm font-black text-ink dark:text-white">{playerTitle(tournament, match, players[1], 1)}</div>
            <small className="player-origin mt-2">{sourceLabel(tournament, match.sources[1])}</small>
          </div>
        </div>

        {match.result && (
          <div className="mt-3 rounded-xl bg-soft px-4 py-3 text-sm text-muted dark:bg-white/[0.04] dark:text-stone-300">
            Результат: <strong className="text-ink dark:text-white">{scoreLabel(match.result)}</strong>. Победитель: {participantName(tournament, match.result.winnerId)}.{editable && ' Выберите новый счёт, чтобы исправить.'}
          </div>
        )}

        <div className="route-explanation"><span>Победитель <strong>{destinationLabel(tournament, match, 'winner')}</strong></span><span>Проигравший <strong>{destinationLabel(tournament, match, 'loser')}</strong></span></div>
        {editable && <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Выберите счёт">
          <button className="score-button" type="button" onClick={() => onSubmit('1-0')}>
            <span className="score-value">1–0</span><span>Первый</span>
          </button>
          <button className={`score-button ${drawMode ? 'selected' : ''}`} type="button" onClick={() => setDrawMode(true)}>
            <span className="score-value">½–½</span><span>Ничья</span>
          </button>
          <button className="score-button" type="button" onClick={() => onSubmit('0-1')}>
            <span className="score-value">0–1</span><span>Второй</span>
          </button>
        </div>}

        {editable && drawMode && (
          <div className="mt-5 rounded-2xl border border-amber/30 bg-amber/10 p-4">
            <div className="text-sm font-black text-ink dark:text-white">Кто победил на тай-брейке?</div>
            <p className="mt-1 text-xs leading-5 text-muted dark:text-stone-300">Без победителя следующий матч не откроется.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {players.map((playerId, index) => (
                <button key={playerId} className="tiebreak-button" type="button" onClick={() => playerId && onSubmit('draw', playerId)}>
                  <Check size={18} /> {index + 1}. {participantName(tournament, playerId)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  const dialogRef = useDialogFocus(onCancel)
  return (
    <div className="modal-backdrop items-center px-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section ref={dialogRef} className="dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className={`mb-4 grid size-12 place-items-center rounded-2xl ${danger ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber/15 text-amber'}`}>
          <RotateCcw size={22} />
        </div>
        <h2 id="confirm-title" className="text-xl font-black text-ink dark:text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-300">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-secondary" type="button" onClick={onCancel}>Отмена</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

interface ShareDialogProps {
  url: string
  onClose: () => void
}

export function ShareDialog({ url, onClose }: ShareDialogProps) {
  const dialogRef = useDialogFocus(onClose)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const copy = async () => {
    setCopyError(false)
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      inputRef.current?.select()
      if (!document.execCommand('copy')) { setCopyError(true); return }
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="modal-backdrop items-center px-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="dialog-card max-w-md" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">Снимок сетки</div>
            <h2 id="share-title" className="text-xl font-black text-ink dark:text-white">Поделиться турниром</h2>
          </div>
          <button className="icon-button btn-ghost shrink-0" type="button" onClick={onClose} aria-label="Закрыть"><X size={21} /></button>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-300">По ссылке зрители увидят обе сетки и текущие результаты. После новых матчей отправьте новую ссылку — снимок не обновляется автоматически.</p>
        {url.length <= 2900 ? (
        <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3 shadow-sm">
          <QRCodeSVG value={url} size={256} level="L" marginSize={4} />
        </div>
        ) : <p className="error-message mt-4">Снимок слишком большой для одного QR-кода. Скопируйте ссылку ниже — она содержит весь турнир.</p>}
        <div className="mt-5 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={17} />
            <input ref={inputRef} className="field w-full truncate pl-9" value={url} readOnly aria-label="Ссылка на турнир" />
          </div>
          <button className="btn-primary icon-button shrink-0" type="button" onClick={copy} aria-label="Копировать ссылку">
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>
        <div className="mt-2 min-h-5 text-center text-xs font-bold text-green dark:text-mint" aria-live="polite">{copied ? 'Ссылка скопирована' : ''}</div>
        {copyError && <p className="error-message">Автокопирование недоступно. Ссылка выделена — скопируйте её вручную.</p>}
      </section>
    </div>
  )
}
