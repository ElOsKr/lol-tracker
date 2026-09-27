import { useMemo, useSyncExternalStore } from "react";
import {
  LANGUAGE_SETTING,
  parseLanguageChoice,
  resolveLanguage,
  translate,
  type Language,
  type LanguageChoice,
  type TranslationKey,
} from "../../shared/i18n";

// Windows's regional locale, handed over by the main process. The packaged app
// ships Chromium's en-US strings alone (electronLanguages), so
// navigator.language reads en-US whatever Windows is set to; it only serves as
// the fallback for a locale Windows could not name.
function systemLocale(): string {
  return window.api.locale ?? navigator.language;
}

// One module-level language, like the queue selection: every component reads
// the same value and re-renders when it changes.
let choice: LanguageChoice = "system";
let language: Language = "en";
const listeners = new Set<() => void>();

export function initLanguage(raw: string | null) {
  choice = parseLanguageChoice(raw);
  language = resolveLanguage(choice, systemLocale());
}

export async function setLanguageChoice(next: LanguageChoice) {
  await window.api.setSetting(LANGUAGE_SETTING, next);
  choice = next;
  language = resolveLanguage(next, systemLocale());
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

/**
 * The translation function for the current language; re-renders on change.
 * Stable while the language stays put, so it is safe in dependency lists.
 */
export function useT(): Translate {
  const current = useSyncExternalStore(subscribe, () => language);
  return useMemo(
    () => (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(current, key, params),
    [current],
  );
}

export function useLanguageChoice(): LanguageChoice {
  return useSyncExternalStore(subscribe, () => choice);
}

/** For code outside React (formatters, one-off messages). */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(language, key, params);
}

export function currentLanguage(): Language {
  return language;
}

/** "1 game" / "{count} games", which nearly every page says somewhere. */
export function gamesLabel(t: Translate, count: number): string {
  return count === 1 ? t("common.game") : t("common.games", { count });
}
