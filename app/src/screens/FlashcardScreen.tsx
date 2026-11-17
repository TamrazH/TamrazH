import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getDifficultWords, getDueWords } from '../lib/selectors';
import { formatDateTime } from '../lib/date';
import { t } from '../lib/i18n';
import { Button, CefrBadge, ScreenHeader } from '../components/ui';
import { getDefinitionDisplay, getExampleDisplay, getTranslationDisplay } from '../lib/contentDisplay';
import { Headword, SpeakButton, Transcription, WordImage } from '../components/wordParts';
import { spokenForm } from '../lib/contentDisplay';
import type { ReviewGrade } from '../types';

export default function FlashcardScreen() {
  const [searchParams] = useSearchParams();
  const set = searchParams.get('set');
  // keyed so switching between the due set and the difficult set starts a fresh session
  return <FlashcardSession key={set ?? 'due'} difficultSet={set === 'difficult'} />;
}

function FlashcardSession({ difficultSet }: { difficultSet: boolean }) {
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const applyGrade = useAppStore((s) => s.applyGrade);

  const sessionWords = useMemo(() => {
    return (difficultSet ? getDifficultWords(words) : getDueWords(words)).slice(0, settings.reviewLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gradeCounts, setGradeCounts] = useState<Record<ReviewGrade, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [revealedTranslation, setRevealedTranslation] = useState(false);
  const showTranslation = settings.showTranslation || revealedTranslation;

  if (sessionWords.length === 0) {
    const difficultCount = getDifficultWords(words).length;
    const nextDue = Object.values(words)
      .filter((w) => w.status !== 'KNOWN' && w.nextReviewAt)
      .map((w) => w.nextReviewAt as string)
      .sort()[0];
    return (
      <div className="pb-4">
        <ScreenHeader title={t.flashcard.title} />
        <div className="flex flex-col gap-3 px-5">
          <p className="text-sm text-[var(--color-text-muted)]">{t.review.empty}</p>
          {nextDue && <p className="text-sm text-[var(--color-text-muted)]">{t.review.nextDue(formatDateTime(nextDue))}</p>}
          {difficultCount > 0 && (
            <Link to="/study/flashcards?set=difficult">
              <Button className="w-full">{t.review.practiceDifficultNow(difficultCount)}</Button>
            </Link>
          )}
          <Link to="/">
            <Button variant="secondary" className="w-full">{t.study.backToHome}</Button>
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
  const definition = getDefinitionDisplay(word);
  const translation = getTranslationDisplay(word);
  const example = getExampleDisplay(word);

  function grade(g: ReviewGrade) {
    applyGrade(word.id, g);
    setGradeCounts((c) => ({ ...c, [g]: c[g] + 1 }));
    setFlipped(false);
    setRevealedTranslation(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col px-5 pb-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{difficultSet ? t.review.difficultTitle : t.flashcard.title}</h1>
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
            <Headword word={word} className="text-3xl font-bold" />
            <p className="text-sm text-[var(--color-text-muted)]">{t.flashcard.tapToReveal}</p>
          </div>

          <div className="flip-card-face flip-card-face-back flex min-h-72 flex-col gap-4 p-6">
            <WordImage word={word} className="aspect-[16/9] shrink-0" />
            <div>
              <div className="flex items-center gap-1">
                <Headword word={word} className="text-xl font-bold" />
                <SpeakButton text={spokenForm(word.word)} accent={settings.pronunciationAccent} label={t.study.pronounce} />
              </div>
              <Transcription word={word} accent={settings.pronunciationAccent} className="text-sm" />
              <p className="text-sm italic text-[var(--color-text-muted)]">{word.partOfSpeech}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {t.wordDetail.definition}
              </div>
              <p className="text-base">{definition.text}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {t.study.translation}
              </div>
              {showTranslation ? (
                <p className="text-base">{translation.text}</p>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRevealedTranslation(true);
                  }}
                  className="text-sm font-medium text-[var(--color-accent)] underline"
                >
                  {t.welcome.showTranslation}
                </button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                {t.study.example}
              </div>
              <div className="flex items-start gap-1">
                <p className="flex-1 pt-2 text-base italic">{example.text}</p>
                {!example.isMissing && (
                  <SpeakButton text={example.text} accent={settings.pronunciationAccent} label={t.study.pronounceExample} rate={0.85} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="sticky bottom-0 -mx-5 mt-2 grid grid-cols-4 gap-2 bg-[var(--color-bg)] px-5 pb-2 pt-3">
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
      )}
    </div>
  );
}
