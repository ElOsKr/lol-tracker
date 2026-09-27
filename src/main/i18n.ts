import { app } from "electron";
import { getSetting } from "./db";
import {
  LANGUAGE_SETTING,
  parseLanguageChoice,
  resolveLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "../shared/i18n";

// The main process has a handful of user-facing strings (tray menu, dialog
// titles). They follow the same setting as the window, read fresh each time so
// a change in Settings is picked up without a restart.
export function mainLanguage(): Language {
  // getSystemLocale, not getLocale: the latter is Chromium's display locale,
  // which is en-US in the packaged app because only that language ships.
  return resolveLanguage(parseLanguageChoice(getSetting(LANGUAGE_SETTING)), app.getSystemLocale());
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(mainLanguage(), key, params);
}
