import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, Card, Modal, ScreenHeader } from '../components/ui';
import { exportAsCsv, exportAsJson, parseImportedJson } from '../lib/exportImport';
import type { PersistedState, ReviewStrategy } from '../types';
import { REVIEW_STRATEGIES, SESSION_SIZES } from '../types';
import { TranslationSwitch } from './WelcomeScreen';

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const words = useAppStore((s) => s.words);
  const progress = useAppStore((s) => s.progress);
  const studySession = useAppStore((s) => s.studySession);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetProgress = useAppStore((s) => s.resetProgress);
  const importState = useAppStore((s) => s.importState);
  const clearStudySession = useAppStore((s) => s.clearStudySession);

  const [resetOpen, setResetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function currentSnapshot(): PersistedState {
    return { version: 2, words, settings, progress, studySession };
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImportedJson(String(reader.result));
        importState(parsed);
        setToast(t.settings.importSuccess);
      } catch {
        setToast(t.settings.importError);
      }
      setTimeout(() => setToast(null), 3000);
    };
    reader.readAsText(file);
  }

  async function handleReset() {
    await resetProgress();
    setResetOpen(false);
    setToast(t.settings.resetSuccess);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <ScreenHeader title={t.settings.title} />

      <Section title={t.settings.dailyTarget}>
        <NumberField
          value={settings.dailyWordTarget}
          min={1}
          max={200}
          onChange={(v) => updateSettings({ dailyWordTarget: v })}
        />
      </Section>

      <Section title={t.settings.newWordsPerSession}>
        <NumberField
          value={settings.newWordsPerSession}
          min={1}
          max={100}
          onChange={(v) => updateSettings({ newWordsPerSession: v })}
        />
      </Section>

      <Section title={t.settings.reviewLimit}>
        <NumberField value={settings.reviewLimit} min={1} max={200} onChange={(v) => updateSettings({ reviewLimit: v })} />
      </Section>

      <Section title={t.settings.lessonOrder}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2">
            {REVIEW_STRATEGIES.map((strategy: ReviewStrategy) => (
              <button
                key={strategy}
                onClick={() => updateSettings({ reviewStrategy: strategy })}
                aria-pressed={settings.reviewStrategy === strategy}
                className={`min-h-11 rounded-xl border px-4 text-left text-sm font-medium ${
                  settings.reviewStrategy === strategy
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
                }`}
              >
                {t.reviewStrategyLabel[strategy]}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">{t.settings.orderExplanation}</p>

          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t.settings.sessionSize}
          </p>
          <div className="flex gap-2">
            {SESSION_SIZES.map((size) => (
              <ToggleButton key={size} active={settings.sessionSize === size} onClick={() => updateSettings({ sessionSize: size })}>
                {size}
              </ToggleButton>
            ))}
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              clearStudySession();
              showToast(t.settings.shuffleNowSuccess);
            }}
          >
            {t.settings.shuffleNow}
          </Button>
        </div>
      </Section>

      <Section title={t.settings.translationVisibility}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[var(--color-text)]">
            {settings.showTranslation ? t.welcome.showTranslation : t.welcome.hideTranslation}
          </span>
          <TranslationSwitch checked={settings.showTranslation} onChange={(v) => updateSettings({ showTranslation: v })} />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{t.welcome.translationHelper}</p>
      </Section>

      <Section title={t.settings.pronunciationAccent}>
        <div className="flex gap-2">
          <ToggleButton
            active={settings.pronunciationAccent === 'american'}
            onClick={() => updateSettings({ pronunciationAccent: 'american' })}
          >
            {t.settings.american}
          </ToggleButton>
          <ToggleButton
            active={settings.pronunciationAccent === 'british'}
            onClick={() => updateSettings({ pronunciationAccent: 'british' })}
          >
            {t.settings.british}
          </ToggleButton>
        </div>
      </Section>

      <Section title={t.settings.interfaceLanguage}>
        <ToggleButton active onClick={() => {}}>
          {t.settings.azerbaijani}
        </ToggleButton>
      </Section>

      <Section title={t.settings.theme}>
        <div className="flex gap-2">
          <ToggleButton active={settings.theme === 'light'} onClick={() => updateSettings({ theme: 'light' })}>
            {t.settings.themeLight}
          </ToggleButton>
          <ToggleButton active={settings.theme === 'dark'} onClick={() => updateSettings({ theme: 'dark' })}>
            {t.settings.themeDark}
          </ToggleButton>
          <ToggleButton active={settings.theme === 'system'} onClick={() => updateSettings({ theme: 'system' })}>
            {t.settings.themeSystem}
          </ToggleButton>
        </div>
      </Section>

      <div className="px-5">
        <p className="text-xs text-[var(--color-text-muted)]">{t.settings.algorithmNote}</p>
      </div>

      <Section title={t.settings.dataManagement}>
        <div className="flex flex-col gap-3">
          <Button variant="secondary" onClick={() => exportAsJson(currentSnapshot())}>
            {t.settings.exportJson}
          </Button>
          <Button variant="secondary" onClick={() => exportAsCsv(currentSnapshot())}>
            {t.settings.exportCsv}
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {t.settings.importProgress}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="danger" onClick={() => setResetOpen(true)}>
            {t.settings.resetProgress}
          </Button>
        </div>
      </Section>

      <Section title={t.admin.title}>
        <Link to="/settings/import-content">
          <Button variant="secondary" className="w-full">
            {t.admin.chooseFile}
          </Button>
        </Link>
      </Section>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2.5rem)] max-w-[420px] -translate-x-1/2 rounded-xl bg-[var(--color-text)] px-4 py-3 text-center text-sm text-[var(--color-bg)] shadow-lg">
          {toast}
        </div>
      )}

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t.settings.resetConfirmTitle}>
        <p className="text-sm text-[var(--color-text-muted)]">{t.settings.resetConfirmBody}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            {t.settings.resetConfirmCancel}
          </Button>
          <Button variant="danger" onClick={handleReset}>
            {t.settings.resetConfirmOk}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5">
      <h2 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      <Card className="p-4">{children}</Card>
    </div>
  );
}

function NumberField({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-semibold active:scale-95"
        aria-label="-"
      >
        −
      </button>
      <span className="text-xl font-semibold">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-lg font-semibold active:scale-95"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
      }`}
    >
      {children}
    </button>
  );
}
