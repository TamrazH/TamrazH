import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Card, ProgressBar, ScreenHeader } from '../components/ui';
import { countByStatus, getAllWords, getCefrProgress } from '../lib/selectors';
import { lastNDays } from '../lib/date';

export default function ProgressScreen() {
  const words = useAppStore((s) => s.words);
  const progress = useAppStore((s) => s.progress);

  const all = getAllWords(words);
  const statusCounts = countByStatus(words);
  const cefrProgress = getCefrProgress(words);

  const totalAnswers = all.reduce((sum, w) => sum + w.correctAnswers + w.incorrectAnswers, 0);
  const correctAnswers = all.reduce((sum, w) => sum + w.correctAnswers, 0);
  const correctRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

  const dueCount = all.filter((w) => w.nextReviewAt !== null).length;
  const overdueOrDone = all.filter((w) => w.lastReviewedAt !== null).length;
  const reviewCompletionRate = dueCount > 0 ? Math.round((overdueOrDone / dueCount) * 100) : 0;

  const days = lastNDays(7);
  const weekly = days.map((d) => progress.dailyLog[d]?.wordsStudied ?? 0);
  const maxWeekly = Math.max(1, ...weekly);

  return (
    <div className="pb-4">
      <ScreenHeader title={t.progressScreen.title} />

      <div className="grid grid-cols-2 gap-3 px-5">
        <StatCard label={t.progressScreen.totalWords} value={all.length} />
        <StatCard label={t.progressScreen.wordsStudied} value={statusCounts.LEARNING + statusCounts.KNOWN + statusCounts.DIFFICULT} />
        <StatCard label={t.progressScreen.wordsKnown} value={statusCounts.KNOWN} accent="success" />
        <StatCard label={t.progressScreen.difficultWords} value={statusCounts.DIFFICULT} accent="danger" />
        <StatCard label={t.progressScreen.reviewCompletion} value={`${reviewCompletionRate}%`} />
        <StatCard label={t.progressScreen.correctRate} value={`${correctRate}%`} />
      </div>

      <div className="mt-5 px-5">
        <h2 className="text-sm font-semibold">{t.progressScreen.weeklyChart}</h2>
        <Card className="mt-2 p-4">
          <WeeklyChart labels={days.map((d) => d.slice(8))} values={weekly} max={maxWeekly} />
        </Card>
      </div>

      <div className="mt-5 px-5">
        <h2 className="text-sm font-semibold">{t.progressScreen.cefrProgress}</h2>
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

      <div className="mt-5 grid grid-cols-2 gap-3 px-5">
        <StatCard label={t.progressScreen.currentStreak} value={progress.streakCurrent} />
        <StatCard label={t.progressScreen.bestStreak} value={progress.streakBest} />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'success' | 'danger' }) {
  const color = accent === 'success' ? 'text-[var(--color-success)]' : accent === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]';
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </Card>
  );
}

function WeeklyChart({ labels, values, max }: { labels: string[]; values: number[]; max: number }) {
  const width = 300;
  const height = 120;
  const barGap = 8;
  const barWidth = (width - barGap * (values.length - 1)) / values.length;

  return (
    <svg viewBox={`0 0 ${width} ${height + 20}`} width="100%" role="img" aria-label={t.progressScreen.weeklyChart}>
      {values.map((v, i) => {
        const barHeight = (v / max) * height;
        const x = i * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx={4} fill="var(--color-accent)" />
            <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
