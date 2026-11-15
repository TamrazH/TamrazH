import type { PronunciationAccent } from '../types';

/**
 * Uses the browser's built-in Web Speech API (SpeechSynthesis) for pronunciation
 * of words and example sentences. No audio files are bundled or played.
 */
export function speak(text: string, accent: PronunciationAccent, rate = 0.9): void {
  if (!isSpeechSupported()) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = accent === 'british' ? 'en-GB' : 'en-US';
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => v.lang === utterance.lang);
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
