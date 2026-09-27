import { en, type Dictionary, type TranslationKey } from "./en";
import { es } from "./es";

export type { TranslationKey } from "./en";

export const LANGUAGE_SETTING = "language";

/** What the user picks: a language, or whatever Windows is set to. */
export type LanguageChoice = "system" | "en" | "es";
export type Language = Exclude<LanguageChoice, "system">;

export const LANGUAGE_CHOICES: LanguageChoice[] = ["system", "en", "es"];

const dictionaries: Record<Language, Dictionary> = { en, es };

export function parseLanguageChoice(raw: string | null | undefined): LanguageChoice {
  return raw === "en" || raw === "es" ? raw : "system";
}

/** Turns a choice into a concrete language, given what the system reports (e.g. "es-ES"). */
export function resolveLanguage(choice: LanguageChoice, systemLocale: string): Language {
  if (choice !== "system") return choice;
  return systemLocale.toLowerCase().startsWith("es") ? "es" : "en";
}

/**
 * Looks a key up in a language, filling `{name}` placeholders from `params`.
 * A key missing from a translation falls back to English rather than showing
 * the raw key, so an incomplete dictionary degrades to mixed language, not
 * to gibberish.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const text = dictionaries[language][key] ?? en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
