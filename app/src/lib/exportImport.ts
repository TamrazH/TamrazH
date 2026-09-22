import type { PersistedState, VocabWord } from '../types';

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAsJson(state: PersistedState): void {
  downloadFile(
    `oxford-vocab-progress-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(state, null, 2),
    'application/json',
  );
}

const CSV_COLUMNS: (keyof VocabWord)[] = [
  'id',
  'word',
  'partOfSpeech',
  'cefrLevel',
  'status',
  'repetitions',
  'correctAnswers',
  'incorrectAnswers',
  'difficulty',
  'confidenceScore',
  'lastReviewedAt',
  'nextReviewAt',
];

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportAsCsv(state: PersistedState): void {
  const rows = Object.values(state.words);
  const header = CSV_COLUMNS.join(',');
  const lines = rows.map((w) => CSV_COLUMNS.map((c) => csvEscape(w[c])).join(','));
  downloadFile(
    `oxford-vocab-progress-${new Date().toISOString().slice(0, 10)}.csv`,
    [header, ...lines].join('\n'),
    'text/csv',
  );
}

export function parseImportedJson(text: string): PersistedState {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.words || !parsed.settings || !parsed.progress) {
    throw new Error('invalid_shape');
  }
  return parsed as PersistedState;
}
