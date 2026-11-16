import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, EmptyState, ScreenHeader } from '../components/ui';
import { Headword } from '../components/wordParts';
import { getPictureWords } from '../lib/selectors';
import { CEFR_LEVELS, type CefrLevel } from '../types';

const PAGE_SIZE = 40;

export default function PictureGalleryScreen() {
  const words = useAppStore((s) => s.words);
  const showTranslation = useAppStore((s) => s.settings.showTranslation);
  const [level, setLevel] = useState<CefrLevel | 'ALL'>('ALL');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const all = useMemo(() => getPictureWords(words).sort((a, b) => a.word.localeCompare(b.word)), [words]);
  const shown = level === 'ALL' ? all : all.filter((w) => w.cefrLevel === level);

  return (
    <div className="pb-6">
      <ScreenHeader title={t.pictures.title} subtitle={t.pictures.subtitle(all.length)} />

      <div className="flex gap-2 overflow-x-auto px-5 pb-3">
        {(['ALL', ...CEFR_LEVELS] as const).map((l) => (
          <button
            key={l}
            onClick={() => {
              setLevel(l);
              setVisible(PAGE_SIZE);
            }}
            aria-pressed={level === l}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              level === l
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
            }`}
          >
            {l === 'ALL' ? t.pictures.allLevels : l}
          </button>
        ))}
      </div>

      {shown.length === 0 && <EmptyState message={t.pictures.empty} />}

      <div className="grid grid-cols-2 gap-3 px-5">
        {shown.slice(0, visible).map((w) => (
          <Link
            key={w.id}
            to={`/words/${w.id}`}
            className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] active:scale-[0.98]"
          >
            <img
              src={`${import.meta.env.BASE_URL}${w.imageUrl}`}
              alt={w.word}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full bg-[var(--color-surface-muted)] object-cover"
            />
            <div className="p-2.5">
              <Headword word={w} className="block truncate text-[15px] font-semibold text-[var(--color-text)]" />
              {showTranslation && w.translationAz && (
                <p className="truncate text-xs text-[var(--color-text-muted)]">{w.translationAz}</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {visible < shown.length && (
        <div className="mt-4 px-5">
          <Button variant="secondary" className="w-full" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {t.pictures.loadMore}
          </Button>
        </div>
      )}
    </div>
  );
}
