import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getDueWords } from '../lib/selectors';
import { t } from '../lib/i18n';
import { Button, CefrBadge, DemoBadge, ScreenHeader } from '../components/ui';
import { getDisplayExample, getDisplayTranslation } from '../lib/demoContent';
import { speakWord } from '../lib/speech';
import type { ReviewGrade } from '../types';

export default function FlashcardScreen() {
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const applyGrade = useAppStore((s) => s.applyGrade);

  const sessionWords = useMemo(() => {
    return getDueWords(words).slice(0, settings.reviewLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gradeCounts, setGradeCounts] = useState<Record<ReviewGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });

  if (sessionWords.length === 0) {
    return (
      <div className="pb-4">
        <ScreenHeader title={t.flashcard.title} />
        <p className="px-5 text-sm text-[var(--color-text-muted)]">{t.review.empty}</p>
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
        <div className="text-5xl">✅</div>
        <h1 className="text-xl font-semibold">{t.study.sessionDone}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {t.flashcard.again}: {gradeCounts.again} · {t.flashcard.hard}: {gradeCounts.hard} · {t.flashcard.good}:{' '}
          {gradeCounts.good} · {t.flashcard.easy}: {gradeCounts.easy}
        </p>
        <Link to="/" className="mt-2 w-full">
          <Button className="w-full">{t.study.backToHome}</Button>
        </Link>
      </div>
    );
  }

  const word = sessionWords[index];
  const translation = getDisplayTranslation(word);
  const example = getDisplayExample(word);

  function grade(g: ReviewGrade) {
    applyGrade(word.id, g);
    setGradeCounts((c) => ({ ...c, [g]: c[g] + 1 }));
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col px-5 pb-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t.flashcard.title}</h1>
        <span className="text-sm font-medium text-[var(--color-text-muted)]">
          {t.study.progressOf(index + 1, sessionWords.length)}
        </span>
      </div>

      <div className="flip-card min-h-72">
        <div
          className={`flip-card-inner relative min-h-72 w-full cursor-pointer rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${
            flipped ? 'is-flipped' : ''
          }`}
          onClick={() => setFlipped((f) => !f)}
        >
          <div className="flip-card-face absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <CefrBadge level={word.cefrLevel} />
            <p className="text-3xl font-bold">{word.word}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{t.flashcard.tapToReveal}</p>
          </div>

          <div className="flip-card-face flip-card-face-back flex flex-col justify-center gap-4 overflow-y-auto p-6">
            <div>
              <p className="text-xl font-bold">{word.word}</p>
              <p className="text-sm italic text-[var(--color-text-muted)]">{word.partOfSpeech}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {t.study.translation}
                {translation.isDemo && <DemoBadge />}
              </div>
              <p className="text-base">{translation.text}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {t.study.example}
                {example.isDemo && <DemoBadge />}
              </div>
              <p className="text-base italic">{example.text}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                speakWord(word.word, settings.pronunciationAccent);
              }}
              className="flex min-h-11 w-fit items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 9v6h4l5 5V4L8 9H4Z" strokeLinejoin="round" />
              </svg>
              {t.study.pronounce}
            </button>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="mt-5 grid grid-cols-4 gap-2">
          <Button variant="danger" onClick={() => grade('again')} className="flex-col text-xs">
            {t.flashcard.again}
          </Button>
          <Button variant="secondary" onClick={() => grade('hard')} className="flex-col text-xs">
            {t.flashcard.hard}
          </Button>
          <Button onClick={() => grade('good')} className="flex-col text-xs">
            {t.flashcard.good}
          </Button>
          <Button onClick={() => grade('easy')} className="flex-col bg-[var(--color-success)] text-xs">
            {t.flashcard.easy}
          </Button>
        </div>
      ) : (
        <p className="mt-5 text-center text-sm text-[var(--color-text-muted)]">{t.flashcard.tapToReveal}</p>
      )}
    </div>
  );
}
