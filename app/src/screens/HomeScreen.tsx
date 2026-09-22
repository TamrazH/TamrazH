import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Card, ProgressBar, ScreenHeader } from '../components/ui';
import { getCefrProgress, getDifficultWords, getDueWords } from '../lib/selectors';
import { todayKey } from '../lib/date';

export default function HomeScreen() {
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const progress = useAppStore((s) => s.progress);

  const dueWords = getDueWords(words);
  const difficultWords = getDifficultWords(words);
  const cefrProgress = getCefrProgress(words);

  const todayLog = progress.dailyLog[todayKey()];
  const wordsLearnedToday = todayLog?.wordsStudied ?? 0;

  return (
    <div className="pb-4">
      <ScreenHeader title={t.home.greeting} subtitle={t.appName} />

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

        <Card className="col-span-2 p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{t.home.reviewDueToday}</p>
          <p className="mt-1 text-2xl font-semibold">{dueWords.length}</p>
        </Card>
      </div>

      <div className="mt-5 px-5">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t.home.cefrProgress}</h2>
        <Card className="mt-2 p-4">
          <div className="flex flex-col gap-3">
            {cefrProgress.map((c) => (
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
      </div>

      <div className="mt-5 flex flex-col gap-3 px-5">
        <Link
          to="/study/lesson"
          className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 text-[15px] font-semibold text-[var(--color-accent-contrast)] active:scale-[0.98]"
        >
          {t.home.startLesson}
        </Link>
        <Link
          to="/study/flashcards"
          className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[15px] font-semibold text-[var(--color-text)] active:scale-[0.98]"
        >
          {t.home.reviewDue} {dueWords.length > 0 ? `(${dueWords.length})` : ''}
        </Link>
        <Link
          to="/words?status=DIFFICULT"
          className="flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[15px] font-semibold text-[var(--color-danger)] active:scale-[0.98]"
        >
          {t.home.difficultWords} {difficultWords.length > 0 ? `(${difficultWords.length})` : ''}
        </Link>
      </div>
    </div>
  );
}
