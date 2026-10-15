import { useMemo, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, Pencil, Plus, Shuffle, Trash2, Trophy, Users, X } from 'lucide-react'
import type { DraftState, Participant } from '../types'

interface SetupScreenProps {
  draft: DraftState
  onChange: (draft: DraftState) => void
  onStart: () => void
}

const makeParticipant = (name: string): Participant => ({
  id: globalThis.crypto?.randomUUID?.() ?? `player-${Date.now()}-${Math.random()}`,
  name: name.trim(),
})

export function SetupScreen({ draft, onChange, onStart }: SetupScreenProps) {
  const [newName, setNewName] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkNames, setBulkNames] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const canStart = draft.name.trim().length > 0 && draft.participants.length >= 2
  const participantWord = useMemo(() => {
    const count = draft.participants.length
    if (count % 10 === 1 && count % 100 !== 11) return 'участник'
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'участника'
    return 'участников'
  }, [draft.participants.length])

  const addNames = (names: string[]) => {
    const cleanNames = names.map((name) => name.trim()).filter(Boolean)
    if (!cleanNames.length) return
    onChange({
      ...draft,
      participants: [...draft.participants, ...cleanNames.map(makeParticipant)],
    })
    setError('')
  }

  const addSingle = () => {
    if (!newName.trim()) {
      setError('Введите имя участника')
      return
    }
    addNames([newName])
    setNewName('')
    inputRef.current?.focus()
  }

  const removeParticipant = (id: string) => {
    onChange({ ...draft, participants: draft.participants.filter((participant) => participant.id !== id) })
  }

  const saveRename = () => {
    if (!editingId || !editingName.trim()) return
    onChange({
      ...draft,
      participants: draft.participants.map((participant) =>
        participant.id === editingId ? { ...participant, name: editingName.trim() } : participant,
      ),
    })
    setEditingId(null)
  }

  const shuffle = () => {
    const participants = [...draft.participants]
    for (let index = participants.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1))
      ;[participants[index], participants[randomIndex]] = [participants[randomIndex], participants[index]]
    }
    onChange({ ...draft, participants })
  }

  const start = () => {
    if (!draft.name.trim()) {
      setError('Введите название турнира')
      return
    }
    if (draft.participants.length < 2) {
      setError('Добавьте минимум двух участников')
      return
    }
    setError('')
    onStart()
  }

  return (
    <main className="setup-page">
      <section className="setup-intro">
        <div className="eyebrow mb-5">Ваш турнир начинается здесь</div>
        <h1 className="display-title text-4xl leading-[1.05] text-ink dark:text-white sm:text-5xl">
          Соберите сетку.<br />Определите чемпиона.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted dark:text-stone-300">
          Добавьте игроков — пары и переходы построятся автоматически. Первое поражение даёт второй шанс, второе завершает участие.
        </p>
        <div className="setup-scheme" aria-label="Правила турнира">
          <div className="scheme-start"><span>01</span><strong>Все играют первый раунд</strong><small>20 игроков = 10 матчей</small></div>
          <div className="scheme-branches"><div><ArrowUpRight size={20} /><strong>Верхняя сетка</strong><small>Победители играют дальше</small></div><div><ArrowUpRight size={20} /><strong>Нижняя сетка</strong><small>Второй шанс после поражения</small></div></div>
          <div className="scheme-finish"><Trophy size={23} /><span><strong>Общий финал</strong><small>Победители обеих сеток встречаются</small></span></div>
        </div>
        <p className="setup-note">Без регистрации. С автоматическим сохранением и ссылкой для зрителей.</p>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line p-5 dark:border-white/10 sm:p-7">
          <label className="field-label" htmlFor="tournament-name">01 / Название турнира</label>
          <input
            id="tournament-name"
            className="field mt-2 text-lg font-semibold"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="Например, Кубок осени"
            maxLength={80}
            autoComplete="off"
          />
        </div>

        <div className="p-5 sm:p-7">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <div className="field-label">02 / Участники</div>
              <p className="mt-1 text-sm text-muted dark:text-stone-400">
                {draft.participants.length} {participantWord}
              </p>
            </div>
            {draft.participants.length > 1 && (
              <button className="btn-secondary" type="button" onClick={shuffle} aria-label="Перемешать участников">
                <Shuffle size={17} />
                <span className="hidden sm:inline">Перемешать</span>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="field min-w-0 flex-1"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addSingle()
                }
              }}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text')
                if (pasted.includes('\n')) {
                  event.preventDefault()
                  addNames(pasted.split(/\r?\n/))
                  setNewName('')
                }
              }}
              placeholder="Имя участника"
              maxLength={80}
              autoComplete="off"
            />
            <button className="btn-primary icon-button shrink-0" type="button" onClick={addSingle} aria-label="Добавить участника">
              <Plus size={22} />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted dark:text-stone-400">Нажмите Enter или вставьте несколько имён по одному на строку.</p>

          <button
            className="mt-3 min-h-11 text-sm font-bold text-green transition hover:text-green-dark dark:text-mint"
            type="button"
            onClick={() => setBulkOpen((open) => !open)}
          >
            {bulkOpen ? 'Скрыть массовый ввод' : 'Вставить список участников'}
          </button>

          {bulkOpen && (
            <div className="mt-2 rounded-2xl bg-soft p-3 dark:bg-white/[0.04]">
              <textarea
                className="field min-h-32 resize-y"
                value={bulkNames}
                onChange={(event) => setBulkNames(event.target.value)}
                placeholder={'Анна\nБорис\nВиктор'}
                aria-label="Список участников, по одному на строку"
              />
              <button
                className="btn-secondary mt-2 w-full"
                type="button"
                onClick={() => {
                  addNames(bulkNames.split(/\r?\n/))
                  setBulkNames('')
                  setBulkOpen(false)
                }}
              >
                <Users size={18} /> Добавить список
              </button>
            </div>
          )}

          {draft.participants.length === 0 ? (
            <div className="empty-state mt-6">
              <Users size={24} />
              <div>
                <div className="font-bold text-ink dark:text-white">Пока никого нет</div>
                <div className="mt-0.5 text-sm">Добавьте минимум двух игроков.</div>
              </div>
            </div>
          ) : (
              <ol className="setup-participants mt-6 space-y-2" aria-label="Участники турнира">
              {draft.participants.map((participant, index) => (
                <li key={participant.id} className="participant-row">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green/10 text-xs font-black text-green dark:bg-mint/10 dark:text-mint">
                    {index + 1}
                  </span>
                  {editingId === participant.id ? (
                    <input
                      className="field min-w-0 flex-1 py-2"
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveRename()
                        if (event.key === 'Escape') setEditingId(null)
                      }}
                      onBlur={saveRename}
                      autoFocus
                      maxLength={80}
                    />
                  ) : (
                    <span className="min-w-0 flex-1 break-words font-semibold text-ink dark:text-stone-100" title={participant.name}>
                      {participant.name}
                    </span>
                  )}
                  {editingId === participant.id ? (
                    <>
                      <button className="row-action" type="button" onMouseDown={(event) => event.preventDefault()} onClick={saveRename} aria-label="Сохранить имя"><Check size={18} /></button>
                      <button className="row-action" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setEditingId(null)} aria-label="Отменить"><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => {
                          setEditingId(participant.id)
                          setEditingName(participant.name)
                        }}
                        aria-label={`Переименовать ${participant.name}`}
                      ><Pencil size={17} /></button>
                      <button className="row-action danger" type="button" onClick={() => removeParticipant(participant.id)} aria-label={`Удалить ${participant.name}`}><Trash2 size={17} /></button>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div className="setup-summary"><Trophy size={21} /><div><strong>До двух поражений</strong><p>{draft.participants.length >= 2 ? `Первый раунд: ${Math.floor(draft.participants.length / 2)} матчей${draft.participants.length % 2 ? ' и один проход без игры' : ', все игроки за досками'}.` : 'Добавьте минимум двух участников.'} При нечётном составе раунда один игрок проходит автоматически. Третье место определяется в финале нижней сетки.</p></div></div>

          {error && <div className="error-message mt-4" role="alert">{error}</div>}

          <button className="btn-primary mt-5 w-full text-base" type="button" onClick={start} disabled={!canStart}>
            Начать турнир <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  )
}
