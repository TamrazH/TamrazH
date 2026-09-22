import type { PronunciationAccent } from '../types';

/**
 * Uses the browser's built-in Web Speech API (SpeechSynthesis) for pronunciation.
 * No audio files are bundled or played — this avoids any copyrighted dictionary
 * audio while still giving the learner a spoken form of the word.
 */
export function speakWord(word: string, accent: PronunciationAccent): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = accent === 'british' ? 'en-GB' : 'en-US';
  utterance.rate = 0.9;

  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => v.lang === utterance.lang);
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
