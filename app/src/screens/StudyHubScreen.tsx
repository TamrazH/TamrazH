import { Link } from 'react-router-dom';
import { ScreenHeader, Card } from '../components/ui';
import { t } from '../lib/i18n';
import { useAppStore } from '../store/useAppStore';
import { getDueWords, getNewWords } from '../lib/selectors';

export default function StudyHubScreen() {
  const words = useAppStore((s) => s.words);
  const dueCount = getDueWords(words).length;
  const newCount = getNewWords(words).length;

  const items = [
    {
      to: '/study/lesson',
      title: t.home.startLesson,
      desc: `${newCount} yeni söz gözləyir`,
    },
    {
      to: '/study/flashcards',
      title: t.flashcard.title,
      desc: `${dueCount} söz təkrar üçün hazırdır`,
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
