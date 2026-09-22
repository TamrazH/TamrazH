import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, Card, ScreenHeader } from '../components/ui';
import { buildQuestions, type PracticeMode } from '../lib/practice';

const QUESTIONS_PER_SESSION = 10;

const MODE_TITLES: Record<PracticeMode, string> = {
  'en-az': t.practice.modeEnAz,
  'az-en': t.practice.modeAzEn,
  choice: t.practice.modeChoice,
  spelling: t.practice.modeSpelling,
  sentence: t.practice.modeSentence,
};

export default function PracticeSessionScreen() {
  const { mode } = useParams<{ mode: string }>();
  const words = useAppStore((s) => s.words);
  const applyGrade = useAppStore((s) => s.applyGrade);

  const validMode = (mode && MODE_TITLES[mode as PracticeMode] ? (mode as PracticeMode) : null) as PracticeMode | null;

  const questions = useMemo(() => {
    if (!validMode) return [];
    return buildQuestions(validMode, words, QUESTIONS_PER_SESSION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validMode]);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);

  if (!validMode) {
    return (
      <div className="pb-4">
        <ScreenHeader title={t.practice.title} />
        <p className="px-5 text-sm text-[var(--color-text-muted)]">{t.common.error}</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="pb-4">
        <ScreenHeader title={MODE_TITLES[validMode]} />
        <p className="px-5 text-sm text-[var(--color-text-muted)]">{t.practice.notEnoughWords}</p>
        <div className="mt-4 px-5">
          <Link to="/study/practice">
            <Button variant="secondary">{t.practice.backToHub}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const done = index >= questions.length;
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 px-5 pt-16 text-center">
        <div className="text-5xl">🏁</div>
        <h1 className="text-xl font-semibold">{t.practice.finished}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t.practice.score(score, questions.length)}</p>
        <Link to="/study/practice" className="mt-2 w-full">
          <Button className="w-full">{t.practice.backToHub}</Button>
        </Link>
      </div>
    );
  }

  const q = questions[index];
  const isCorrectSelected = selected !== null && selected.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
  const isCorrectTyped = textAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();

  function choose(option: string) {
    if (revealed) return;
    setSelected(option);
    setRevealed(true);
    const correct = option.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    if (correct) setScore((s) => s + 1);
    applyGrade(q.word.id, applyReviewGradeFor(correct));
  }

  function submitTyped() {
    if (revealed) return;
    setRevealed(true);
    const correct = textAnswer.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
    if (correct) setScore((s) => s + 1);
    applyGrade(q.word.id, applyReviewGradeFor(correct));
  }

  function next() {
    setSelected(null);
    setTextAnswer('');
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col px-5 pb-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">{MODE_TITLES[validMode]}</h1>
        <span className="text-sm font-medium text-[var(--color-text-muted)]">{t.practice.question(index + 1, questions.length)}</span>
      </div>

      <Card className="p-6">
        <p className="mt-2 text-xl font-semibold text-[var(--color-text)]">{q.promptText}</p>
      </Card>

      {q.kind === 'choice' && q.options && (
        <div className="mt-5 flex flex-col gap-3">
          {q.options.map((opt) => {
            const isThisCorrect = opt.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase();
            const isThisSelected = selected === opt;
            let style = 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]';
            if (revealed && isThisCorrect) style = 'border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]';
            else if (revealed && isThisSelected && !isThisCorrect) style = 'border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]';
            return (
              <button
                key={opt}
                onClick={() => choose(opt)}
                disabled={revealed}
                className={`min-h-12 rounded-xl border px-4 text-left text-[15px] font-medium disabled:opacity-100 ${style}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {q.kind === 'input' && (
        <div className="mt-5 flex flex-col gap-3">
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            disabled={revealed}
            placeholder={t.practice.typeAnswer}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          {!revealed && (
            <Button onClick={submitTyped} disabled={textAnswer.trim().length === 0}>
              {t.practice.submit}
            </Button>
          )}
        </div>
      )}

      {revealed && (
        <div className="mt-4 flex flex-col gap-3">
          <p className={`text-sm font-semibold ${(q.kind === 'choice' ? isCorrectSelected : isCorrectTyped) ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {(q.kind === 'choice' ? isCorrectSelected : isCorrectTyped) ? t.practice.correct : t.practice.incorrect}
          </p>
          {!(q.kind === 'choice' ? isCorrectSelected : isCorrectTyped) && (
            <p className="text-sm text-[var(--color-text-muted)]">{t.practice.correctAnswerWas(q.correctAnswer)}</p>
          )}
          <Button onClick={next}>{t.practice.next}</Button>
        </div>
      )}
    </div>
  );
}

function applyReviewGradeFor(correct: boolean) {
  return correct ? 'good' : 'again';
}
