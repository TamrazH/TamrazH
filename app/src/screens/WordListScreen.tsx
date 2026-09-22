import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Card, CefrBadge, EmptyState, ScreenHeader, StatusBadge } from '../components/ui';
import { CEFR_LEVELS, WORD_STATUSES, type CefrLevel, type WordStatus } from '../types';
import { getPartsOfSpeech } from '../lib/selectors';

type SortMode = 'alpha' | 'difficulty' | 'nextReview';

const PAGE_SIZE = 60;

export default function WordListScreen() {
  const words = useAppStore((s) => s.words);
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<CefrLevel | 'ALL'>('ALL');
  const [status, setStatus] = useState<WordStatus | 'ALL'>((searchParams.get('status') as WordStatus | null) ?? 'ALL');
  const [pos, setPos] = useState<string>('ALL');
  const [sort, setSort] = useState<SortMode>('alpha');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const posOptions = useMemo(() => getPartsOfSpeech(words), [words]);

  const filtered = useMemo(() => {
    let list = Object.values(words);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((w) => w.word.toLowerCase().includes(q));
    }
    if (level !== 'ALL') list = list.filter((w) => w.cefrLevel === level);
    if (status !== 'ALL') list = list.filter((w) => w.status === status);
    if (pos !== 'ALL') list = list.filter((w) => w.partOfSpeech === pos);

    list = list.slice().sort((a, b) => {
      if (sort === 'alpha') return a.word.localeCompare(b.word);
      if (sort === 'difficulty') return b.difficulty - a.difficulty;
      // nextReview: words with a date come first (soonest first), words without go last
      const aTime = a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : Infinity;
      const bTime = b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : Infinity;
      return aTime - bTime;
    });
    return list;
  }, [words, query, level, status, pos, sort]);

  function updateStatus(next: WordStatus | 'ALL') {
    setStatus(next);
    setVisibleCount(PAGE_SIZE);
    const params = new URLSearchParams(searchParams);
    if (next === 'ALL') params.delete('status');
    else params.set('status', next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="pb-4">
      <ScreenHeader title={t.words.title} subtitle={t.words.resultsCount(filtered.length)} />

      <div className="flex flex-col gap-3 px-5">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder={t.words.searchPlaceholder}
          className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Select label={t.words.filterLevel} value={level} onChange={(v) => { setLevel(v as CefrLevel | 'ALL'); setVisibleCount(PAGE_SIZE); }} options={[{ value: 'ALL', label: t.words.all }, ...CEFR_LEVELS.map((l) => ({ value: l, label: l }))]} />
          <Select label={t.words.filterStatus} value={status} onChange={(v) => updateStatus(v as WordStatus | 'ALL')} options={[{ value: 'ALL', label: t.words.all }, ...WORD_STATUSES.map((s) => ({ value: s, label: t.status[s] }))]} />
          <Select label={t.words.filterPos} value={pos} onChange={(v) => { setPos(v); setVisibleCount(PAGE_SIZE); }} options={[{ value: 'ALL', label: t.words.all }, ...posOptions.map((p) => ({ value: p, label: p }))]} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(
            [
              ['alpha', t.words.sortAlpha],
              ['difficulty', t.words.sortDifficulty],
              ['nextReview', t.words.sortNextReview],
            ] as [SortMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setSort(mode)}
              className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-medium ${
                sort === mode
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 px-5">
        {filtered.length === 0 && <EmptyState message={t.words.noResults} />}
        {filtered.slice(0, visibleCount).map((w) => (
          <Link key={w.id} to={`/words/${w.id}`}>
            <Card className="flex items-center justify-between p-3.5 active:scale-[0.99]">
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--color-text)]">{w.word}</p>
                <p className="truncate text-xs italic text-[var(--color-text-muted)]">{w.partOfSpeech}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CefrBadge level={w.cefrLevel} />
                <StatusBadge status={w.status} />
              </div>
            </Card>
          </Link>
        ))}
        {visibleCount < filtered.length && (
          <button
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
            className="mt-2 min-h-11 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-muted)]"
          >
            {t.words.loadMore}
          </button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
