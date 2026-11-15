import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, Card, CefrBadge, ScreenHeader } from '../components/ui';
import { getDefinitionDisplay, getExampleDisplay, getTranslationDisplay } from '../lib/contentDisplay';
import { SpeakButton, Transcription, WordImage } from '../components/wordParts';
import { spokenForm } from '../lib/contentDisplay';
import type { Oxford5000Scope } from '../types';

export default function WordStudyScreen() {
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const studySession = useAppStore((s) => s.studySession);
  const ensureStudySession = useAppStore((s) => s.ensureStudySession);
  const startNewStudySession = useAppStore((s) => s.startNewStudySession);
  const markKnown = useAppStore((s) => s.markKnown);
  const markDifficult = useAppStore((s) => s.markDifficult);
  const recordWordsStudied = useAppStore((s) => s.recordWordsStudied);
  const advanceStudySession = useAppStore((s) => s.advanceStudySession);
  const [searchParams] = useSearchParams();
  const oxford5000Scope = (searchParams.get('scope') as Oxford5000Scope | null) ?? 'ALL';

  const [counts, setCounts] = useState({ known: 0, unknown: 0 });
  const [revealedTranslation, setRevealedTranslation] = useState(false);
  const showTranslation = settings.showTranslation || revealedTranslation;
  const accent = settings.pronunciationAccent;

  // Resume today's unfinished session for this mode/scope if one matches (same
  // ordering settings, same day), otherwise generate a fresh one. The generated
  // order is snapshotted into the session so refreshing the page or navigating
  // away and back does not reshuffle or lose lesson progress.
  useEffect(() => {
    ensureStudySession(settings.activeMode, oxford5000Scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const belongsToThisScreen =
    studySession && studySession.mode === settings.activeMode && studySession.oxford5000Scope === oxford5000Scope;
  const sessionWords = belongsToThisScreen ? studySession!.wordIds.map((id) => words[id]).filter(Boolean) : [];
  const index = belongsToThisScreen ? studySession!.currentIndex : 0;

  if (!belongsToThisScreen) {
    // session not created yet (effect hasn't run) — render nothing for one tick
    return null;
  }

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
          {t.study.sessionSummary(counts.known, counts.unknown)}
        </p>
        <div className="mt-2 flex w-full flex-col gap-3">
          <Link to="/">
            <Button className="w-full">{t.study.backToHome}</Button>
          </Link>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => startNewStudySession(settings.activeMode, oxford5000Scope)}
          >
            {t.study.startNewSession}
          </Button>
        </div>
      </div>
    );
  }

  const word = sessionWords[index];
  const definition = getDefinitionDisplay(word);
  const translation = getTranslationDisplay(word);
  const example = getExampleDisplay(word);

  function advance(known: boolean) {
    if (known) {
      markKnown(word.id);
      setCounts((c) => ({ ...c, known: c.known + 1 }));
    } else {
      markDifficult(word.id);
      setCounts((c) => ({ ...c, unknown: c.unknown + 1 }));
    }
    recordWordsStudied(1);
    setRevealedTranslation(false);
    advanceStudySession();
  }

  return (
    <div className="flex flex-col px-5 pb-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t.study.title}</h1>
        <span className="text-sm font-medium text-[var(--color-text-muted)]">
          {t.study.progressOf(index + 1, sessionWords.length)}
        </span>
      </div>
      <p className="-mt-3 mb-4 text-xs text-[var(--color-text-muted)]">
        {t.reviewStrategyLabel[studySession!.reviewStrategy]}
      </p>

      <Card key={word.id} className="animate-fade-in flex flex-col gap-5 p-5">
        <WordImage word={word} className="aspect-[4/3]" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold text-[var(--color-text)]">{word.word}</p>
              <SpeakButton text={spokenForm(word.word)} accent={accent} label={t.study.pronounce} />
            </div>
            <Transcription word={word} accent={accent} />
            <p className="mt-1 text-sm italic text-[var(--color-text-muted)]">{word.partOfSpeech}</p>
          </div>
          <CefrBadge level={word.cefrLevel} />
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.wordDetail.definition}
          </div>
          <p className={`mt-1 text-base ${definition.isMissing ? 'italic text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
            {definition.text}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.study.translation}
          </div>
          {showTranslation ? (
            <p className={`mt-1 text-base ${translation.isMissing ? 'italic text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
              {translation.text}
            </p>
          ) : (
            <button
              onClick={() => setRevealedTranslation(true)}
              className="mt-1 min-h-11 text-sm font-medium text-[var(--color-accent)] underline"
            >
              {t.welcome.showTranslation}
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.study.example}
          </div>
          <div className="mt-1 flex items-start gap-1">
            <p className={`flex-1 pt-2 text-base italic ${example.isMissing ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'}`}>
              {example.text}
            </p>
            {!example.isMissing && (
              <SpeakButton text={example.text} accent={accent} label={t.study.pronounceExample} rate={0.85} />
            )}
          </div>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="danger" onClick={() => advance(false)}>
          {t.study.dontKnow}
        </Button>
        <Button onClick={() => advance(true)}>{t.study.know}</Button>
      </div>
    </div>
  );
}
