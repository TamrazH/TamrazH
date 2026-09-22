import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { t } from '../lib/i18n';
import { Button, Card, ScreenHeader } from '../components/ui';
import { parseImportFile, validateImportRows, type ValidationResult } from '../lib/importValidation';

export default function AdminImportScreen() {
  const words = useAppStore((s) => s.words);
  const applyContentImport = useAppStore((s) => s.applyContentImport);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [result, setResult] = useState<ValidationResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  function handleFile(file: File) {
    setError(null);
    setResult(null);
    setImported(false);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseImportFile(String(reader.result), file.name);
        setResult(validateImportRows(rows, words));
      } catch {
        setError(t.settings.importError);
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!result) return;
    applyContentImport(result.rows);
    setImported(true);
  }

  const r = result?.report;

  return (
    <div className="flex flex-col gap-4 px-5 pb-6 pt-6">
      <button onClick={() => navigate(-1)} className="w-fit text-sm font-medium text-[var(--color-text-muted)]">
        ← {t.common.close}
      </button>

      <ScreenHeader title={t.admin.title} subtitle={t.admin.subtitle} />

      <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
        {t.admin.chooseFile}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,application/json,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {fileName && <p className="text-xs text-[var(--color-text-muted)]">{fileName}</p>}
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {r && (
        <Card className="flex flex-col gap-1 p-4 text-sm">
          <p className="mb-1 font-semibold">{t.admin.reportTitle}</p>
          <p>{t.admin.rowsTotal(r.rowsTotal)}</p>
          <p className="text-[var(--color-success)]">{t.admin.rowsValid(r.rowsValid)}</p>
          <p className="text-[var(--color-danger)]">{t.admin.rowsInvalid(r.rowsInvalid)}</p>
          <hr className="my-2 border-[var(--color-border)]" />
          <p>{t.admin.matchedExisting(r.matchedExisting)}</p>
          <p>{t.admin.notMatched(r.notMatched)}</p>
          <hr className="my-2 border-[var(--color-border)]" />
          <p>{t.admin.duplicateWords(r.duplicateWords)}</p>
          <p>{t.admin.duplicateWordPos(r.duplicateWordPos)}</p>
          <p>{t.admin.missingWord(r.missingWord)}</p>
          <p>{t.admin.invalidCefr(r.invalidCefr)}</p>
          <p>{t.admin.invalidPos(r.invalidPos)}</p>
          <p>{t.admin.emptyTranslation(r.emptyTranslation)}</p>
          <p>{t.admin.emptyDefinition(r.emptyDefinition)}</p>
          <p>{t.admin.emptyExample(r.emptyExample)}</p>
        </Card>
      )}

      {r && r.rowsValid === 0 && <p className="text-sm text-[var(--color-text-muted)]">{t.admin.noValidRows}</p>}

      {r && r.rowsValid > 0 && !imported && (
        <Button onClick={confirmImport}>{t.admin.confirmImport}</Button>
      )}

      {imported && r && <p className="text-sm font-semibold text-[var(--color-success)]">{t.admin.importSuccess(r.rowsValid)}</p>}

      <Link to="/settings" className="text-center text-sm font-medium text-[var(--color-accent)]">
        {t.settings.title}
      </Link>
    </div>
  );
}
