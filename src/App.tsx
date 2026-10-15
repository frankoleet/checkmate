import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Moon, RotateCcw, Sun } from 'lucide-react'
import { ConfirmDialog } from './components/Dialogs'
import { SetupScreen } from './components/SetupScreen'
import { TournamentScreen } from './components/TournamentScreen'
import { createDoubleTournament } from './lib/bracket'
import { decodeTournament } from './lib/share'
import { clearState, emptyState, loadState, saveState, THEME_KEY } from './lib/storage'
import type { StoredAppState, Tournament } from './types'

type AppMode = 'manage' | 'view' | 'invalid-link'
type Theme = 'light' | 'dark'

interface BootstrapState {
  mode: AppMode
  state: StoredAppState
  error?: string
}

function bootstrap(): BootstrapState {
  const payload = new URLSearchParams(window.location.search).get('view')
  if (payload) {
    try {
      const tournament = decodeTournament(payload)
      return {
        mode: 'view',
        state: {
          screen: 'tournament',
          tournament,
          draft: {
            name: tournament.name,
            participants: tournament.participants,
            includeThirdPlace: tournament.includeThirdPlace,
          },
        },
      }
    } catch (error) {
      return {
        mode: 'invalid-link',
        state: emptyState,
        error: error instanceof Error ? error.message : 'Не удалось открыть ссылку.',
      }
    }
  }
  return { mode: 'manage', state: loadState() }
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const initial = useMemo(bootstrap, [])
  const [mode, setMode] = useState<AppMode>(initial.mode)
  const [appState, setAppState] = useState<StoredAppState>(initial.state)
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error'>('saved')
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (mode !== 'manage') return
    try {
      saveState(appState)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [appState, mode])

  const goHome = () => {
    window.history.replaceState({}, '', window.location.pathname)
    setMode('manage')
    setAppState(loadState())
  }

  const restoreTournament = () => {
    if (!appState.tournament) return
    const restored: StoredAppState = {
      screen: 'tournament',
      tournament: appState.tournament,
      draft: {
        name: appState.tournament.name,
        participants: appState.tournament.participants,
        includeThirdPlace: appState.tournament.includeThirdPlace,
      },
    }
    window.history.replaceState({}, '', window.location.pathname)
    setMode('manage')
    setAppState(restored)
  }

  const resetTournament = () => {
    clearState()
    window.history.replaceState({}, '', window.location.pathname)
    setMode('manage')
    setAppState(emptyState)
    setResetOpen(false)
  }

  const startTournament = () => {
    const tournament = createDoubleTournament(
      appState.draft.name,
      appState.draft.participants,
    )
    setAppState({ ...appState, screen: 'tournament', tournament })
  }

  const tournament = appState.tournament

  return (
    <div className="min-h-dvh bg-page text-ink transition-colors dark:bg-page-dark dark:text-white">
      <header className="app-header">
        <button className="brand" type="button" onClick={mode === 'view' ? goHome : undefined} aria-label="Шахматная сетка — на главную">
          <span className="brand-mark" aria-hidden="true">♞</span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-black tracking-tight text-ink dark:text-white">ШАХМАТНАЯ СЕТКА</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted dark:text-stone-400">Каждый ход имеет значение</span>
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          {mode === 'manage' && (
            <div className={`save-status hidden sm:flex ${saveStatus === 'error' ? 'error' : ''}`}>
              {saveStatus === 'saved' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {saveStatus === 'saved' ? 'Сохранено' : 'Ошибка сохранения'}
            </div>
          )}
          {appState.screen === 'tournament' && mode === 'manage' && tournament && (
            <button className="header-button" type="button" onClick={() => setResetOpen(true)} aria-label="Создать новый турнир">
              <RotateCcw size={18} /> <span className="hidden md:inline">Новый турнир</span>
            </button>
          )}
          <button
            className="icon-button btn-ghost"
            type="button"
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {mode === 'invalid-link' ? (
        <main className="grid min-h-[calc(100dvh-72px)] place-items-center px-4 py-10">
          <section className="panel max-w-md p-6 text-center sm:p-8">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><AlertTriangle size={26} /></div>
            <h1 className="mt-5 text-2xl font-black text-ink dark:text-white">Ссылка не открылась</h1>
            <p className="mt-2 text-sm leading-6 text-muted dark:text-stone-300">{initial.error}</p>
            <button className="btn-primary mt-6 w-full" type="button" onClick={goHome}>Перейти к своему турниру</button>
          </section>
        </main>
      ) : appState.screen === 'setup' || !tournament ? (
        <SetupScreen draft={appState.draft} onChange={(draft) => setAppState({ ...appState, draft })} onStart={startTournament} />
      ) : (
        <TournamentScreen
          tournament={tournament}
          readOnly={mode === 'view'}
          onChange={(next: Tournament) => setAppState({ ...appState, tournament: next })}
          onRestore={restoreTournament}
        />
      )}

      {resetOpen && (
        <ConfirmDialog
          title="Создать новый турнир?"
          message="Текущая сетка и все результаты будут удалены с этого устройства. Сначала можно сохранить ссылку через кнопку «Поделиться турниром»."
          confirmLabel="Удалить и создать"
          danger
          onCancel={() => setResetOpen(false)}
          onConfirm={resetTournament}
        />
      )}
    </div>
  )
}
