import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { useAppStore } from './store/useAppStore';
import { useTheme } from './lib/useTheme';
import { t } from './lib/i18n';

import HomeScreen from './screens/HomeScreen';
import StudyHubScreen from './screens/StudyHubScreen';
import WordStudyScreen from './screens/WordStudyScreen';
import FlashcardScreen from './screens/FlashcardScreen';
import PracticeHubScreen from './screens/PracticeHubScreen';
import PracticeSessionScreen from './screens/PracticeSessionScreen';
import WordListScreen from './screens/WordListScreen';
import WordDetailScreen from './screens/WordDetailScreen';
import ProgressScreen from './screens/ProgressScreen';
import SettingsScreen from './screens/SettingsScreen';
import AdminImportScreen from './screens/AdminImportScreen';

function AppShell() {
  useTheme();
  const location = useLocation();
  return (
    <>
      <main className="flex-1 overflow-y-auto pb-2">
        {/* Keyed by pathname so screens fully remount on navigation (including param-only
            changes like /words/:id or /study/practice/:mode) instead of reusing stale state. */}
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/study" element={<StudyHubScreen />} />
          <Route path="/study/lesson" element={<WordStudyScreen />} />
          <Route path="/study/flashcards" element={<FlashcardScreen />} />
          <Route path="/study/practice" element={<PracticeHubScreen />} />
          <Route path="/study/practice/:mode" element={<PracticeSessionScreen />} />
          <Route path="/words" element={<WordListScreen />} />
          <Route path="/words/:id" element={<WordDetailScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/import-content" element={<AdminImportScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </>
  );
}

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    void hydrate();
    const timer = setTimeout(() => setMinSplashDone(true), 150);
    return () => clearTimeout(timer);
  }, [hydrate]);

  if (!hydrated || !minSplashDone) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--color-text-muted)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        <p className="text-sm">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}
