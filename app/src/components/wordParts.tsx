import { useState } from 'react';
import type { PronunciationAccent, VocabWord } from '../types';
import { speak } from '../lib/speech';
import { senseLabel, spokenForm } from '../lib/contentDisplay';

function transcriptionFor(word: VocabWord, accent: PronunciationAccent): string | null {
  return accent === 'british' ? (word.pronunciationUk ?? word.pronunciation) : (word.pronunciation ?? word.pronunciationUk);
}

export function Transcription({ word, accent, className = '' }: { word: VocabWord; accent: PronunciationAccent; className?: string }) {
  const ipa = transcriptionFor(word, accent);
  if (!ipa) return null;
  return <p className={`text-base text-[var(--color-text-muted)] ${className}`}>[{ipa}]</p>;
}

export function SpeakButton({
  text,
  accent,
  label,
  rate,
  className = '',
}: {
  text: string;
  accent: PronunciationAccent;
  label: string;
  rate?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text, accent, rate);
      }}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-accent)] active:scale-90 active:bg-[var(--color-accent-soft)] ${className}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 9v6h4l5 5V4L8 9H4Z" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
        <path d="M19 6a8.5 8.5 0 0 1 0 12" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Word illustration; renders nothing if the word has no image or the file fails to load. */
export function WordImage({ word, className = '' }: { word: VocabWord; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!word.imageUrl || failed) return null;
  const credit = word.imageCredit;
  return (
    <figure className="relative shrink-0">
      <img
        src={`${import.meta.env.BASE_URL}${word.imageUrl}`}
        alt={word.word}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`w-full rounded-xl bg-[var(--color-surface-muted)] object-cover ${className}`}
      />
      {credit && (
        <figcaption className="absolute bottom-1 right-1 max-w-[90%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-tight text-white">
          <a
            href={credit.source}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline-offset-2 hover:underline"
          >
            {credit.author} · {credit.license}
          </a>
        </figcaption>
      )}
    </figure>
  );
}

/** Headword without the dataset's homograph number, with any sense label shown small ("bank (money)"). */
export function Headword({ word, className = '' }: { word: VocabWord; className?: string }) {
  const label = senseLabel(word.word);
  return (
    <span className={className}>
      {spokenForm(word.word)}
      {label && <span className="ml-1.5 text-[0.6em] font-medium text-[var(--color-text-muted)]">({label})</span>}
    </span>
  );
}
