import { useEffect, useState } from 'react';
import { useAppStore, STATE_VERSION } from '../store/useAppStore';
import { Card, ScreenHeader } from '../components/ui';
import { detectStorageBackend, getLastSavedAt, getMigrationStatus, countBackups } from '../lib/storage';
import { formatDateTime } from '../lib/date';

/**
 * Dev-only diagnostics for verifying persistence health (storage backend, dataset/schema
 * version, record counts, last save, migration status). Never shown in production builds,
 * and never surfaces word content, translations, or anything else user-authored.
 */
export default function StorageDiagnosticsScreen() {
  const words = useAppStore((s) => s.words);
  const [backend, setBackend] = useState<string>('checking…');

  useEffect(() => {
    void detectStorageBackend().then(setBackend);
  }, []);

  const wordList = Object.values(words);
  const totalWords = wordList.length;
  const withProgress = wordList.filter((w) => w.status !== 'NEW' || w.repetitions > 0).length;
  const lastSavedAt = getLastSavedAt();
  const migration = getMigrationStatus();
  const backupCount = countBackups();

  return (
    <div className="flex flex-col gap-4 pb-6">
      <ScreenHeader title="Storage diagnostics" subtitle="Development build only" />
      <div className="px-5">
        <Card className="flex flex-col divide-y divide-[var(--color-border)] p-0">
          <Row label="Origin" value={window.location.origin} />
          <Row label="Storage backend" value={backend} />
          <Row label="Schema version" value={String(STATE_VERSION)} />
          <Row label="Vocabulary dataset size" value={`${totalWords} words`} />
          <Row label="Progress records" value={`${withProgress} / ${totalWords}`} />
          <Row label="Last saved" value={lastSavedAt ? formatDateTime(lastSavedAt) : 'never'} />
          <Row
            label="Migration status"
            value={migration ? `v${migration.fromVersion} → v${migration.toVersion} at ${formatDateTime(migration.migratedAt)}` : 'no migration recorded'}
          />
          <Row label="Pre-migration backups kept" value={String(backupCount)} />
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-text)]">{value}</span>
    </div>
  );
}
