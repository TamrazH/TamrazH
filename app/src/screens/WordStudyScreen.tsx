import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getWordPoolForMode } from '../lib/selectors';
import { t } from '../lib/i18n';
import { Button, Card, CefrBadge, ContentStatusBadge, ScreenHeader } from '../components/ui';
import { getExampleDisplay, getTranslationDisplay } from '../lib/contentDisplay';
import { speakWord } from '../lib/speech';
import type { Oxford5000Scope } from '../types';

export default function WordStudyScreen() {
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const markKnown = useAppStore((s) => s.markKnown);
  const markDifficult = useAppStore((s) => s.markDifficult);
  const markReviewLater = useAppStore((s) => s.markReviewLater);
  const recordWordsStudied = useAppStore((s) => s.recordWordsStudied);
  const [searchParams] = useSearchParams();
  const oxford5000Scope = (searchParams.get('scope') as Oxford5000Scope | null) ?? 'ALL';

  const sessionWords = useMemo(() => {
    const pool = getWordPoolForMode(words, settings.activeMode, oxford5000Scope);
    return pool
      .filter((w) => w.status === 'NEW')
      .sort((a, b) => a.word.localeCompare(b.word))
      .slice(0, settings.newWordsPerSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [counts, setCounts] = useState({ known: 0, difficult: 0, later: 0 });

  if (sessionWords.length === 0) {
    return (
      <div className="pb-4">
        <ScreenHeader title={t.study.title} />
        <p className="px-5 text-sm text-[var(--color-text-muted)]">{t.study.noWords}</p>
        <div className="mt-4 px-5">
          <Link to="/">
            <Button variant="secondary">{t.study.backToHome}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const done = index >= sessionWords.length;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 pt-16 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-xl font-semibold">{t.study.sessionDone}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t.study.sessionSummary(counts.known, counts.difficult, counts.later)}
        </p>
        <Link to="/" className="mt-2 w-full">
          <Button className="w-full">{t.study.backToHome}</Button>
        </Link>
      </div>
    );
  }

  const word = sessionWords[index];
  const translation = getTranslationDisplay(word);
  const example = getExampleDisplay(word);

  function advance(kind: 'known' | 'difficult' | 'later') {
    if (kind === 'known') {
      markKnown(word.id);
      setCounts((c) => ({ ...c, known: c.known + 1 }));
    } else if (kind === 'difficult') {
      markDifficult(word.id);
      setCounts((c) => ({ ...c, difficult: c.difficult + 1 }));
    } else {
      markReviewLater(word.id);
      setCounts((c) => ({ ...c, later: c.later + 1 }));
    }
    recordWordsStudied(1);
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col px-5 pb-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t.study.title}</h1>
        <span className="text-sm font-medium text-[var(--color-text-muted)]">
          {t.study.progressOf(index + 1, sessionWords.length)}
        </span>
      </div>

      <Card key={word.id} className="animate-fade-in flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{word.word}</p>
            <p className="mt-1 text-sm italic text-[var(--color-text-muted)]">{word.partOfSpeech}</p>
          </div>
          <CefrBadge level={word.cefrLevel} />
        </div>

        <button
          onClick={() => speakWord(word.word, settings.pronunciationAccent)}
          className="flex min-h-11 w-fit items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] active:scale-95"
          aria-label={t.study.pronounce}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 9v6h4l5 5V4L8 9H4Z" strokeLinejoin="round" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
          </svg>
          {t.study.pronounce}
        </button>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.study.translation}
            <ContentStatusBadge status={translation.status} />
          </div>
          <p className={`mt-1 text-base ${translation.isMissing ? 'italic text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
            {translation.text}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.study.example}
            <ContentStatusBadge status={example.status} />
          </div>
          <p className={`mt-1 text-base italic ${example.isMissing ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
            {example.text}
          </p>
        </div>
      </Card>

      <div className="mt-5 flex flex-col gap-3">
        <Button onClick={() => advance('known')} className="w-full">
          {t.study.know}
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="danger" onClick={() => advance('difficult')}>
            {t.study.difficult}
          </Button>
          <Button variant="secondary" onClick={() => advance('later')}>
            {t.study.reviewLater}
          </Button>
        </div>
      </div>
    </div>
  );
}
