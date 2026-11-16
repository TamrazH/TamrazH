import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Card, ProgressBar, ScreenHeader } from '../components/ui';
import { countByStatus, getAllWords, getCefrProgress, getDueWords } from '../lib/selectors';
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

  const dueCount = getDueWords(words).length;

  // every answered word counts (lessons, flashcards and practice all log reviewsCompleted)
  const days = lastNDays(7);
  const weekly = days.map((d) => progress.dailyLog[d]?.reviewsCompleted ?? 0);
  const maxWeekly = Math.max(1, ...weekly);
  const dayLabels = days.map((d, i) =>
    i === days.length - 1 ? t.progressScreen.today : t.progressScreen.weekdaysShort[new Date(`${d}T00:00:00`).getDay()],
  );

  return (
    <div className="pb-4">
      <ScreenHeader title={t.progressScreen.title} />

      <div className="grid grid-cols-2 gap-3 px-5">
        <StatCard label={t.progressScreen.totalWords} value={all.length} />
        <StatCard label={t.progressScreen.wordsStudied} value={statusCounts.LEARNING + statusCounts.KNOWN + statusCounts.DIFFICULT} />
        <StatCard label={t.progressScreen.wordsKnown} value={statusCounts.KNOWN} accent="success" />
        <StatCard
          label={t.progressScreen.difficultWords}
          value={statusCounts.DIFFICULT}
          accent="danger"
          to={statusCounts.DIFFICULT > 0 ? '/study/flashcards?set=difficult' : undefined}
        />
        <StatCard label={t.progressScreen.dueNow} value={dueCount} to={dueCount > 0 ? '/study/flashcards' : undefined} />
        <StatCard label={t.progressScreen.correctRate} value={`${correctRate}%`} />
      </div>

      <div className="mt-5 px-5">
        <h2 className="text-sm font-semibold">{t.progressScreen.weeklyChart}</h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{t.progressScreen.weeklyChartHint}</p>
        <Card className="mt-2 p-4">
          <WeeklyChart labels={dayLabels} values={weekly} max={maxWeekly} />
          <p className="mt-2 text-right text-xs font-medium text-[var(--color-text-muted)]">
            {t.progressScreen.weeklyTotal(weekly.reduce((a, b) => a + b, 0))}
          </p>
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

function StatCard({
  label,
  value,
  accent,
  to,
}: {
  label: string;
  value: string | number;
  accent?: 'success' | 'danger';
  /** When set, the card opens these words for review. */
  to?: string;
}) {
  const color = accent === 'success' ? 'text-[var(--color-success)]' : accent === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]';
  const card = (
    <Card className={`h-full p-4 ${to ? 'active:scale-[0.98]' : ''}`}>
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className={`text-xl font-semibold ${color}`}>{value}</p>
        {to && (
          <span className="text-xs font-semibold text-[var(--color-accent)]">
            {t.progressScreen.review} ›
          </span>
        )}
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} aria-label={`${label}: ${value}. ${t.progressScreen.review}`}>
      {card}
    </Link>
  ) : (
    card
  );
}

function WeeklyChart({ labels, values, max }: { labels: string[]; values: number[]; max: number }) {
  const width = 300;
  const height = 120;
  const top = 16;
  const barGap = 8;
  const barWidth = (width - barGap * (values.length - 1)) / values.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${top + height + 20}`}
      width="100%"
      role="img"
      aria-label={`${t.progressScreen.weeklyChart}: ${labels.map((l, i) => `${l} ${values[i]}`).join(', ')}`}
    >
      {values.map((v, i) => {
        const barHeight = (v / max) * height;
        const x = i * (barWidth + barGap);
        const y = top + height - barHeight;
        const isToday = i === values.length - 1;
        return (
          <g key={i}>
            <rect
              x={x}
              y={v > 0 ? y : top + height - 2}
              width={barWidth}
              height={v > 0 ? Math.max(barHeight, 3) : 2}
              rx={4}
              fill={v > 0 ? 'var(--color-accent)' : 'var(--color-border)'}
            />
            {v > 0 && (
              <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-text)">
                {v}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={top + height + 15}
              textAnchor="middle"
              fontSize="10"
              fontWeight={isToday ? '600' : '400'}
              fill={isToday ? 'var(--color-text)' : 'var(--color-text-muted)'}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
