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
  return resolveLanguage(parseLanguageChoice(getSetting(LANGUAGE_SETTING)), app.getLocale());
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(mainLanguage(), key, params);
}
