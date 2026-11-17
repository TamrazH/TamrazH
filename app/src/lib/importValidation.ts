import { CEFR_LEVELS, CONTENT_STATUSES, type CefrLevel, type ContentStatus, type DefinitionSource, type VocabWord } from '../types';

/** Maps the general contentStatus onto the definition-specific source/status enum. */
function definitionSourceForContentStatus(status: ContentStatus): DefinitionSource {
  switch (status) {
    case 'VERIFIED':
      return 'OXFORD_LICENSED';
    case 'LICENSED':
      return 'APPROVED_DICTIONARY';
    case 'OWN_CONTENT':
      return 'OWN_CONTENT';
    case 'AI_DRAFT':
      return 'AI';
    default:
      return 'MISSING';
  }
}

/** Known part-of-speech abbreviations used by the Oxford lists (mirrors the original extraction). */
const KNOWN_POS_TOKENS = new Set([
  'v.',
  'n.',
  'adj.',
  'adv.',
  'prep.',
  'conj.',
  'pron.',
  'det.',
  'exclam.',
  'number',
  'modal v.',
  'auxiliary v.',
  'indefinite article',
  'definite article',
  'article',
  'infinitive marker',
]);

function looksLikeValidPos(pos: string): boolean {
  if (!pos.trim()) return false;
  // allow combos like "n., adj." / "det./pron." / "n., adj./adv." — every comma/semicolon/slash
  // separated part must be a known token (the Oxford lists mix all three separators).
  const parts = pos
    .split(/[;,/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => KNOWN_POS_TOKENS.has(p));
}

export interface ImportRow {
  rowNumber: number;
  word: string;
  partOfSpeech: string;
  cefrLevel: string;
  translationAz: string;
  englishDefinition: string;
  exampleSentence: string;
  pronunciation: string;
  audioUrl: string;
  synonyms: string;
  contentSource: string;
  contentStatus: string;
}

export interface RowIssues {
  missingWord: boolean;
  invalidCefr: boolean;
  invalidPos: boolean;
  emptyTranslation: boolean;
  emptyDefinition: boolean;
  emptyExample: boolean;
  duplicateInFile: boolean;
  duplicateWordPosInFile: boolean;
  notMatchedInDataset: boolean;
}

export interface ValidatedRow {
  row: ImportRow;
  issues: RowIssues;
  isValid: boolean;
  matchedWordId: string | null;
}

export interface ValidationReport {
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  duplicateWords: number;
  duplicateWordPos: number;
  missingWord: number;
  invalidCefr: number;
  invalidPos: number;
  emptyTranslation: number;
  emptyDefinition: number;
  emptyExample: number;
  matchedExisting: number;
  notMatched: number;
}

export interface ValidationResult {
  rows: ValidatedRow[];
  report: ValidationReport;
}

// --- Parsing ---------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function get(obj: Record<string, string>, key: string): string {
  return (obj[key] ?? '').trim();
}

export function parseImportFile(text: string, filename: string): ImportRow[] {
  const isJson = filename.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{');
  if (isJson) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.words || [];
    return list.map((raw: Record<string, unknown>, i: number) => ({
      rowNumber: i + 1,
      word: String(raw.word ?? ''),
      partOfSpeech: String(raw.partOfSpeech ?? ''),
      cefrLevel: String(raw.cefrLevel ?? ''),
      translationAz: String(raw.translationAz ?? ''),
      englishDefinition: String(raw.englishDefinition ?? ''),
      exampleSentence: String(raw.exampleSentence ?? ''),
      pronunciation: String(raw.pronunciation ?? ''),
      audioUrl: String(raw.audioUrl ?? ''),
      synonyms: Array.isArray(raw.synonyms) ? raw.synonyms.join(';') : String(raw.synonyms ?? ''),
      contentSource: String(raw.contentSource ?? ''),
      contentStatus: String(raw.contentStatus ?? ''),
    }));
  }

  const csvRows = parseCsv(text);
  if (csvRows.length === 0) return [];
  const header = csvRows[0].map((h) => h.trim());
  return csvRows.slice(1).map((cells, i) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h] = cells[idx] ?? ''));
    return {
      rowNumber: i + 2, // account for header row, 1-indexed
      word: get(obj, 'word'),
      partOfSpeech: get(obj, 'partOfSpeech'),
      cefrLevel: get(obj, 'cefrLevel'),
      translationAz: get(obj, 'translationAz'),
      englishDefinition: get(obj, 'englishDefinition'),
      exampleSentence: get(obj, 'exampleSentence'),
      pronunciation: get(obj, 'pronunciation'),
      audioUrl: get(obj, 'audioUrl'),
      synonyms: get(obj, 'synonyms'),
      contentSource: get(obj, 'contentSource'),
      contentStatus: get(obj, 'contentStatus'),
    };
  });
}

// --- Validation --------------------------------------------------------------

export function validateImportRows(rows: ImportRow[], existingWords: Record<string, VocabWord>): ValidationResult {
  const wordCounts = new Map<string, number>();
  const wordPosCounts = new Map<string, number>();
  for (const r of rows) {
    const wKey = r.word.trim().toLowerCase();
    wordCounts.set(wKey, (wordCounts.get(wKey) ?? 0) + 1);
    const wpKey = `${wKey}|${r.partOfSpeech.trim().toLowerCase()}`;
    wordPosCounts.set(wpKey, (wordPosCounts.get(wpKey) ?? 0) + 1);
  }

  const byWordPos = new Map<string, string>(); // "word|pos" -> id, for matching
  const byWordOnly = new Map<string, string[]>(); // "word" -> ids (for single-sense fallback match)
  for (const w of Object.values(existingWords)) {
    byWordPos.set(`${w.word.trim().toLowerCase()}|${w.partOfSpeech.trim().toLowerCase()}`, w.id);
    const list = byWordOnly.get(w.word.trim().toLowerCase()) ?? [];
    list.push(w.id);
    byWordOnly.set(w.word.trim().toLowerCase(), list);
  }

  const validated: ValidatedRow[] = rows.map((row) => {
    const wKey = row.word.trim().toLowerCase();
    const wpKey = `${wKey}|${row.partOfSpeech.trim().toLowerCase()}`;

    let matchedWordId = byWordPos.get(wpKey) ?? null;
    if (!matchedWordId) {
      const candidates = byWordOnly.get(wKey) ?? [];
      if (candidates.length === 1) matchedWordId = candidates[0];
    }

    const issues: RowIssues = {
      missingWord: !row.word.trim(),
      invalidCefr: !CEFR_LEVELS.includes(row.cefrLevel.trim() as CefrLevel),
      invalidPos: !looksLikeValidPos(row.partOfSpeech),
      emptyTranslation: !row.translationAz.trim(),
      emptyDefinition: !row.englishDefinition.trim(),
      emptyExample: !row.exampleSentence.trim(),
      duplicateInFile: (wordCounts.get(wKey) ?? 0) > 1,
      duplicateWordPosInFile: (wordPosCounts.get(wpKey) ?? 0) > 1,
      notMatchedInDataset: !matchedWordId,
    };

    const isValid =
      !issues.missingWord &&
      !issues.invalidCefr &&
      !issues.invalidPos &&
      !issues.emptyTranslation &&
      !issues.emptyDefinition &&
      !issues.emptyExample &&
      !issues.duplicateWordPosInFile &&
      !issues.notMatchedInDataset;

    return { row, issues, isValid, matchedWordId };
  });

  const report: ValidationReport = {
    rowsTotal: validated.length,
    rowsValid: validated.filter((v) => v.isValid).length,
    rowsInvalid: validated.filter((v) => !v.isValid).length,
    duplicateWords: validated.filter((v) => v.issues.duplicateInFile).length,
    duplicateWordPos: validated.filter((v) => v.issues.duplicateWordPosInFile).length,
    missingWord: validated.filter((v) => v.issues.missingWord).length,
    invalidCefr: validated.filter((v) => v.issues.invalidCefr).length,
    invalidPos: validated.filter((v) => v.issues.invalidPos).length,
    emptyTranslation: validated.filter((v) => v.issues.emptyTranslation).length,
    emptyDefinition: validated.filter((v) => v.issues.emptyDefinition).length,
    emptyExample: validated.filter((v) => v.issues.emptyExample).length,
    matchedExisting: validated.filter((v) => v.matchedWordId !== null).length,
    notMatched: validated.filter((v) => v.matchedWordId === null).length,
  };

  return { rows: validated, report };
}

/** Applies validated+matched rows onto the dataset, touching ONLY content fields — never progress. */
export function applyImportRows(
  words: Record<string, VocabWord>,
  validated: ValidatedRow[],
): Record<string, VocabWord> {
  const next = { ...words };
  for (const v of validated) {
    if (!v.isValid || !v.matchedWordId) continue;
    const existing = next[v.matchedWordId];
    if (!existing) continue;
    const status: ContentStatus = CONTENT_STATUSES.includes(v.row.contentStatus as ContentStatus)
      ? (v.row.contentStatus as ContentStatus)
      : 'AI_DRAFT';
    next[v.matchedWordId] = {
      ...existing,
      translationAz: v.row.translationAz || existing.translationAz,
      englishDefinition: v.row.englishDefinition || existing.englishDefinition,
      exampleSentence: v.row.exampleSentence || existing.exampleSentence,
      pronunciation: v.row.pronunciation || existing.pronunciation,
      audioUrl: v.row.audioUrl || existing.audioUrl,
      synonyms: v.row.synonyms ? v.row.synonyms.split(';').map((s) => s.trim()).filter(Boolean) : existing.synonyms,
      contentSource: v.row.contentSource || existing.contentSource,
      contentStatus: status,
      ...(v.row.englishDefinition
        ? { definitionSource: definitionSourceForContentStatus(status), definitionStatus: definitionSourceForContentStatus(status) }
        : {}),
    };
  }
  return next;
}
