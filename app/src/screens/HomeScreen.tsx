import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Card, ProgressBar, ScreenHeader } from '../components/ui';
import { getCefrProgress, getDifficultWords, getDueWords, getOxford3000Stats, getOxford5000Stats, type ModeStats } from '../lib/selectors';
import { todayKey } from '../lib/date';
import { APP_MODES, CEFR_LEVELS, type AppMode, type VocabWord } from '../types';

export default function HomeScreen() {
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const progress = useAppStore((s) => s.progress);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const dueWords = getDueWords(words);
  const difficultWords = getDifficultWords(words);
  const todayLog = progress.dailyLog[todayKey()];
  const wordsLearnedToday = todayLog?.wordsStudied ?? 0;

  const activeMode = settings.activeMode;

  return (
    <div className="pb-4">
      <ScreenHeader title={t.home.greeting} subtitle={t.appName} />

      <ModeSelector activeMode={activeMode} onSelect={(m) => updateSettings({ activeMode: m })} />

      <div className="grid grid-cols-2 gap-3 px-5">
        <Card className="p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t.home.todayTarget}</p>
          <p className="mt-1 text-2xl font-semibold">
            {wordsLearnedToday}
            <span className="text-base font-normal text-[var(--color-text-muted)]"> / {settings.dailyWordTarget}</span>
          </p>
          <div className="mt-2">
            <ProgressBar value={wordsLearnedToday} max={settings.dailyWordTarget} />
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t.home.currentStreak}</p>
          <p className="mt-1 text-2xl font-semibold">
            {progress.streakCurrent}
            <span className="text-base font-normal text-[var(--color-text-muted)]"> {t.home.days}</span>
          </p>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {t.progressScreen.bestStreak}: {progress.streakBest}
          </p>
        </Card>
      </div>

      {activeMode === 'OXFORD_3000' && <Oxford3000Panel words={words} />}
      {activeMode === 'OXFORD_5000' && <Oxford5000Panel words={words} />}

      {activeMode === 'REVIEW_DUE' && (
        <div className="mt-4 px-5">
          <Card className="p-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t.home.dueWords}</p>
            <p className="mt-1 text-2xl font-semibold">{dueWords.length}</p>
          </Card>
          <Link
            to="/study/flashcards"
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-accent-contrast)] active:scale-[0.98]"
          >
            {t.home.reviewDue}
          </Link>
        </div>
      )}

      {activeMode === 'DIFFICULT' && (
        <div className="mt-4 px-5">
          <Card className="p-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)]">{t.progressScreen.difficultWords}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-danger)]">{difficultWords.length}</p>
          </Card>
          <Link
            to="/words?status=DIFFICULT"
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-danger)] px-4 text-[15px] font-semibold text-white active:scale-[0.98]"
          >
            {t.home.difficultWords}
          </Link>
        </div>
      )}
    </div>
  );
}

function ModeSelector({ activeMode, onSelect }: { activeMode: AppMode; onSelect: (m: AppMode) => void }) {
  return (
    <div className="px-5 pb-1">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {t.modes.activeModeLabel}
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {APP_MODES.map((m) => (
          <button
            key={m}
            onClick={() => onSelect(m)}
            aria-pressed={activeMode === m}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              activeMode === m
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
            }`}
          >
            {t.modes[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${colorClass ?? ''}`}>{value}</p>
    </Card>
  );
}

function StatRow({ stats }: { stats: ModeStats }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      <StatTile label={t.progressScreen.totalWords} value={stats.total} />
      <StatTile label={t.progressScreen.wordsStudied} value={stats.studied} />
      <StatTile label={t.progressScreen.wordsKnown} value={stats.known} colorClass="text-[var(--color-success)]" />
      <StatTile label={t.progressScreen.difficultWords} value={stats.difficult} colorClass="text-[var(--color-danger)]" />
      <StatTile label={t.home.dueWords} value={stats.due} />
    </div>
  );
}

function ModeCefrProgress({ words, levels }: { words: Record<string, VocabWord>; levels: readonly string[] }) {
  const progress = getCefrProgress(words).filter((c) => levels.includes(c.level));
  return (
    <Card className="mt-2 p-4">
      <div className="flex flex-col gap-3">
        {progress.map((c) => (
          <div key={c.level}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold">{c.level}</span>
              <span className="text-[var(--color-text-muted)]">
                {c.known} / {c.total}
              </span>
            </div>
            <ProgressBar value={c.known} max={c.total} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Oxford3000Panel({ words }: { words: Record<string, VocabWord> }) {
  const stats = getOxford3000Stats(words);
  return (
    <div className="mt-4">
      <div className="px-5">
        <h2 className="mb-2 text-sm font-semibold">{t.home.oxford3000Dashboard}</h2>
        <StatRow stats={stats} />
      </div>
      <div className="mt-4 px-5">
        <h2 className="mb-2 text-sm font-semibold">{t.home.cefrProgress}</h2>
        <ModeCefrProgress words={filterWordsByFlag(words, 'isOxford3000')} levels={['A1', 'A2', 'B1', 'B2']} />
      </div>
      <div className="mt-4 px-5">
        <Link
          to="/study/lesson"
          className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-accent-contrast)] active:scale-[0.98]"
        >
          {t.home.startLesson}
        </Link>
      </div>
    </div>
  );
}

function Oxford5000Panel({ words }: { words: Record<string, VocabWord> }) {
  const stats = getOxford5000Stats(words);
  return (
    <div className="mt-4">
      <div className="px-5">
        <h2 className="mb-2 text-sm font-semibold">{t.home.oxford5000Dashboard}</h2>
        <p className="mb-1 text-xs font-semibold text-[var(--color-text-muted)]">{t.modes.foundation}</p>
        <StatRow stats={stats.foundation} />
        <p className="mb-1 mt-3 text-xs font-semibold text-[var(--color-text-muted)]">{t.modes.additional}</p>
        <StatRow stats={stats.additional} />
        <p className="mb-1 mt-3 text-xs font-semibold text-[var(--color-text-muted)]">{t.modes.complete}</p>
        <StatRow stats={stats.complete} />
      </div>
      <div className="mt-4 px-5">
        <h2 className="mb-2 text-sm font-semibold">{t.home.cefrProgress}</h2>
        <ModeCefrProgress words={words} levels={CEFR_LEVELS} />
      </div>
      <div className="mt-4 flex flex-col gap-3 px-5">
        <p className="text-xs font-semibold text-[var(--color-text-muted)]">{t.modes.chooseLessonScope}</p>
        <Link
          to="/study/lesson?scope=ALL"
          className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-accent-contrast)] active:scale-[0.98]"
        >
          {t.modes.startFromAll}
        </Link>
        <Link
          to="/study/lesson?scope=ADDITIONAL_ONLY"
          className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[15px] font-semibold text-[var(--color-text)] active:scale-[0.98]"
        >
          {t.modes.startFromAdditionalOnly}
        </Link>
      </div>
    </div>
  );
}

function filterWordsByFlag(words: Record<string, VocabWord>, flag: 'isOxford3000' | 'isAdditionalOxford5000') {
  const out: Record<string, VocabWord> = {};
  for (const [id, w] of Object.entries(words)) if (w[flag]) out[id] = w;
  return out;
}
