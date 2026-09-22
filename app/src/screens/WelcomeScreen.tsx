import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, Card } from '../components/ui';

/**
 * One-time entry/setup screen shown before a first-time user reaches the Home
 * dashboard. Lets them pick a mode and the translation-visibility default
 * before starting — both stay changeable later from Settings/Home.
 */
export default function WelcomeScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const navigate = useNavigate();

  function start() {
    updateSettings({ hasCompletedOnboarding: true });
    navigate('/', { replace: true });
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-8 pt-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{t.welcome.appTitle}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t.welcome.subtitle}</p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t.welcome.chooseMode}</h2>
        <div className="flex gap-2">
          <ModeButton
            active={settings.activeMode === 'OXFORD_3000'}
            onClick={() => updateSettings({ activeMode: 'OXFORD_3000' })}
          >
            {t.modes.OXFORD_3000}
          </ModeButton>
          <ModeButton
            active={settings.activeMode === 'OXFORD_5000'}
            onClick={() => updateSettings({ activeMode: 'OXFORD_5000' })}
          >
            {t.modes.OXFORD_5000}
          </ModeButton>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--color-text)]">{t.welcome.translationLabel}</span>
          <TranslationSwitch checked={settings.showTranslation} onChange={(v) => updateSettings({ showTranslation: v })} />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t.welcome.translationHelper}</p>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t.welcome.dailyTarget}</h2>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => updateSettings({ dailyWordTarget: Math.max(1, settings.dailyWordTarget - 5) })}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-semibold active:scale-95"
              aria-label="-"
            >
              −
            </button>
            <span className="text-xl font-semibold">{settings.dailyWordTarget}</span>
            <button
              onClick={() => updateSettings({ dailyWordTarget: Math.min(200, settings.dailyWordTarget + 5) })}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-semibold active:scale-95"
              aria-label="+"
            >
              +
            </button>
          </div>
        </Card>
      </div>

      <Button onClick={start} className="w-full">
        {t.welcome.startLesson}
      </Button>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 flex-1 rounded-xl border px-4 text-sm font-semibold ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]'
      }`}
    >
      {children}
    </button>
  );
}

export function TranslationSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={checked ? t.welcome.hideTranslation : t.welcome.showTranslation}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-muted)]'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-[var(--color-surface)] shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
