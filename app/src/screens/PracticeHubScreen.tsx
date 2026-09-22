import { Link } from 'react-router-dom';
import { ScreenHeader, Card } from '../components/ui';
import { t } from '../lib/i18n';

const MODES = [
  { id: 'en-az', title: t.practice.modeEnAz, desc: t.practice.modeEnAzDesc },
  { id: 'az-en', title: t.practice.modeAzEn, desc: t.practice.modeAzEnDesc },
  { id: 'choice', title: t.practice.modeChoice, desc: t.practice.modeChoiceDesc },
  { id: 'spelling', title: t.practice.modeSpelling, desc: t.practice.modeSpellingDesc },
  { id: 'sentence', title: t.practice.modeSentence, desc: t.practice.modeSentenceDesc },
];

export default function PracticeHubScreen() {
  return (
    <div className="pb-4">
      <ScreenHeader title={t.practice.title} subtitle={t.practice.hubSubtitle} />
      <div className="flex flex-col gap-3 px-5">
        {MODES.map((mode) => (
          <Link key={mode.id} to={`/study/practice/${mode.id}`}>
            <Card className="p-4 active:scale-[0.99]">
              <p className="font-semibold text-[var(--color-text)]">{mode.title}</p>
              <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{mode.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
