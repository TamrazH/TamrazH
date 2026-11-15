import { Link } from 'react-router-dom';
import { ScreenHeader, Card } from '../components/ui';
import { t } from '../lib/i18n';
import { useAppStore } from '../store/useAppStore';
import { getDifficultWords, getDueWords, getWordPoolForMode } from '../lib/selectors';

export default function StudyHubScreen() {
  const words = useAppStore((s) => s.words);
  const activeMode = useAppStore((s) => s.settings.activeMode);
  const dueCount = getDueWords(words).length;
  const difficultCount = getDifficultWords(words).length;
  // lessons draw from the active mode's list, so count new words there
  const lessonMode = activeMode === 'OXFORD_3000' ? 'OXFORD_3000' : 'OXFORD_5000';
  const newCount = getWordPoolForMode(words, lessonMode).filter((w) => w.status === 'NEW').length;

  const items = [
    {
      to: '/study/lesson',
      title: t.home.startLesson,
      desc: t.studyHub.newWaiting(newCount, t.modes[lessonMode]),
    },
    {
      to: '/study/flashcards',
      title: t.flashcard.title,
      desc: dueCount > 0 ? t.review.dueCount(dueCount) : difficultCount > 0 ? t.studyHub.difficultWaiting(difficultCount) : t.studyHub.nothingDue,
    },
    {
      to: '/study/practice',
      title: t.practice.title,
      desc: t.practice.hubSubtitle,
    },
  ];

  return (
    <div className="pb-4">
      <ScreenHeader title={t.nav.study} />
      <div className="flex flex-col gap-3 px-5">
        {items.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="flex items-center justify-between p-4 active:scale-[0.99]">
              <div>
                <p className="font-semibold text-[var(--color-text)]">{item.title}</p>
                <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{item.desc}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-muted)]">
                <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
