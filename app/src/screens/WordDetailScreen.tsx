import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, Card, CefrBadge, StatusBadge } from '../components/ui';
import { getDefinitionDisplay, getExampleDisplay, getTranslationDisplay } from '../lib/contentDisplay';
import { formatDateTime } from '../lib/date';
import { SpeakButton, Transcription, WordImage } from '../components/wordParts';
import { spokenForm } from '../lib/contentDisplay';

export default function WordDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const words = useAppStore((s) => s.words);
  const settings = useAppStore((s) => s.settings);
  const markKnown = useAppStore((s) => s.markKnown);
  const markDifficult = useAppStore((s) => s.markDifficult);
  const [revealedTranslation, setRevealedTranslation] = useState(false);
  const showTranslation = settings.showTranslation || revealedTranslation;

  const word = id ? words[id] : undefined;

  if (!word) {
    return (
      <div className="px-5 pt-8">
        <p className="text-sm text-[var(--color-text-muted)]">{t.common.error}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm font-medium text-[var(--color-accent)]">
          ← {t.common.close}
        </button>
      </div>
    );
  }

  const translation = getTranslationDisplay(word);
  const definition = getDefinitionDisplay(word);
  const example = getExampleDisplay(word);

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
      <button onClick={() => navigate(-1)} className="w-fit text-sm font-medium text-[var(--color-text-muted)]">
        ← {t.common.close}
      </button>

      <Card className="flex flex-col gap-4 p-5">
        <WordImage word={word} className="aspect-[4/3]" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{word.word}</p>
              <SpeakButton text={spokenForm(word.word)} accent={settings.pronunciationAccent} label={t.study.pronounce} />
            </div>
            <Transcription word={word} accent={settings.pronunciationAccent} />
            <p className="mt-1 text-sm italic text-[var(--color-text-muted)]">{word.partOfSpeech}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <CefrBadge level={word.cefrLevel} />
            <StatusBadge status={word.status} />
          </div>
        </div>

        {showTranslation ? (
          <DetailField label={t.study.translation} value={translation.text} isMissing={translation.isMissing} />
        ) : (
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t.study.translation}
            </div>
            <button
              onClick={() => setRevealedTranslation(true)}
              className="mt-1 text-sm font-medium text-[var(--color-accent)] underline"
            >
              {t.welcome.showTranslation}
            </button>
          </div>
        )}
        <DetailField label={t.wordDetail.definition} value={definition.text} isMissing={definition.isMissing} />
        <div className="flex items-start gap-1">
          <div className="flex-1">
            <DetailField label={t.study.example} value={example.text} isMissing={example.isMissing} italic />
          </div>
          {!example.isMissing && (
            <SpeakButton text={example.text} accent={settings.pronunciationAccent} label={t.study.pronounceExample} rate={0.85} />
          )}
        </div>

        {word.allSenses && word.allSenses.length > 1 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t.wordDetail.otherSenses}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {word.allSenses.map((s, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs text-[var(--color-text)]"
                >
                  {s.partOfSpeech} · {s.cefrLevel}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <p className="text-sm font-semibold">{t.wordDetail.statistics}</p>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <Stat label={t.wordDetail.repetitions} value={word.repetitions} />
          <Stat label={t.wordDetail.confidence} value={`${word.confidenceScore}%`} />
          <Stat label={t.wordDetail.correct} value={word.correctAnswers} />
          <Stat label={t.wordDetail.incorrect} value={word.incorrectAnswers} />
        </div>
        <div className="mt-4 flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          <p>
            {t.wordDetail.lastReviewed}: {word.lastReviewedAt ? formatDateTime(word.lastReviewedAt) : t.wordDetail.never}
          </p>
          <p>
            {t.wordDetail.nextReview}: {word.nextReviewAt ? formatDateTime(word.nextReviewAt) : t.wordDetail.never}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => markKnown(word.id)}>
          {t.words.markKnown}
        </Button>
        <Button variant="danger" onClick={() => markDifficult(word.id)}>
          {t.words.markDifficult}
        </Button>
      </div>

      <Link to="/words" className="text-center text-sm font-medium text-[var(--color-accent)]">
        {t.words.title}
      </Link>
    </div>
  );
}

function DetailField({
  label,
  value,
  isMissing,
  italic,
}: {
  label: string;
  value: string;
  isMissing: boolean;
  italic?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <p
        className={`mt-1 text-base ${italic ? 'italic' : ''} ${
          isMissing ? 'italic text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
