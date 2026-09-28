import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useBackfill } from "../hooks/useBackfill";
import { saveHomePath, saveNavLayout, useHomePath, useNavLayout } from "../hooks/useNavLayout";
import { setLanguageChoice, useLanguageChoice, useT, type Translate } from "../lib/i18n";
import { moveNavItem, setNavItemHidden, visibleNavItems } from "../../shared/navigation";
import { LANGUAGE_CHOICES, type LanguageChoice } from "../../shared/i18n";
import { LOCALE } from "../lib/format";

import { setRemembering } from "../lib/viewState";
import { GAME_NOTICE_OBS_SETTING, GAME_NOTICE_SETTING } from "../../shared/notice";
import { OPEN_ON_CLIENT_SETTING } from "../../shared/startup";
import { SGP_HISTORY_CAP } from "../lib/types";
import type { BackupInfo, ImportProgress } from "../lib/types";
import {
  DEFAULT_SESSION_GROUPING,
  SESSION_GROUPING_SETTING,
  parseSessionGrouping,
  type SessionGrouping,
} from "../../shared/session";

const SESSION_GROUPING_OPTIONS: SessionGrouping[] = ["day", "week", "patch", "none"];

const BACKUP_REASONS = ["auto", "manual", "pre-import", "pre-repair", "pre-restore"] as const;

function backupReason(t: Translate, reason: string): string {
  const known = BACKUP_REASONS.find((r) => r === reason);
  return known ? t(`backup.reason.${known}`) : reason;
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTaken(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString(LOCALE)} ${date.toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function Switch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${checked ? "bg-lol-gold" : "bg-lol-border"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// The key a shortcut answers to, drawn as a key rather than as prose
function Keys({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-lol-border bg-white/5 px-2 py-1 font-sans text-xs tabular-nums text-lol-text-bright">
      {children}
    </kbd>
  );
}

export default function Settings() {
  // Shared so a backfill started automatically on first connect shows here too
  const { running: backfilling, progress } = useBackfill();
  const navLayout = useNavLayout();
  const homePath = useHomePath();
  const languageChoice = useLanguageChoice();
  const t = useT();
  const [autoStart, setAutoStart] = useState(false);
  // Only the packaged program has a path worth registering, so the switch says
  // so instead of pretending in a dev build
  const [autoStartSupported, setAutoStartSupported] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [hideRemakes, setHideRemakes] = useState(false);
  const [sessionGrouping, setSessionGrouping] = useState<SessionGrouping>(DEFAULT_SESSION_GROUPING);
  const [autoBackup, setAutoBackup] = useState(true);
  const [rememberFilters, setRememberFilters] = useState(false);
  const [gameNotice, setGameNotice] = useState(true);
  const [gameNoticeObs, setGameNoticeObs] = useState(false);
  const [openOnClient, setOpenOnClient] = useState(false);
  const [leagueShortcutSupported, setLeagueShortcutSupported] = useState(false);
  const [shortcutStatus, setShortcutStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [repairStatus, setRepairStatus] = useState<string | null>(null);
  const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  // Restoring replaces the whole database, so the row asks a second time
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      window.api.getSetting("auto_start"),
      window.api.isAutoStartSupported(),
      window.api.getSetting("minimize_to_tray"),

      window.api.getSetting("hide_remakes"),
      window.api.getSetting("auto_backup"),
      window.api.getSetting("remember_filters"),
      window.api.getSetting(SESSION_GROUPING_SETTING),
      window.api.getSetting(GAME_NOTICE_SETTING),
      window.api.getSetting(GAME_NOTICE_OBS_SETTING),
      window.api.getSetting(OPEN_ON_CLIENT_SETTING),
      window.api.isLeagueShortcutSupported(),
    ]).then(
      ([
        startup,
        startupSupported,
        tray,
        remakes,
        backup,
        remember,
        grouping,
        notice,
        noticeObs,
        openClient,
        shortcutSupported,
      ]) => {
        setAutoStart(startup === "true");
        setAutoStartSupported(startupSupported);
        setMinimizeToTray(tray !== "false");
        setHideRemakes(remakes === "true");
        setAutoBackup(backup !== "false");
        setRememberFilters(remember === "true");
        setSessionGrouping(parseSessionGrouping(grouping));
        setGameNotice(notice !== "false");
        setGameNoticeObs(noticeObs === "true");
        setOpenOnClient(openClient === "true");
        setLeagueShortcutSupported(shortcutSupported);
        setLoading(false);
      },
    );
  }, []);

  const handleLeagueShortcut = async () => {
    setShortcutStatus(null);
    const result = await window.api.createLeagueShortcut();
    setShortcutStatus(
      result.success
        ? t("settings.leagueShortcutDone")
        : t("settings.leagueShortcutFailed", { error: result.error ?? "" }),
    );
  };

  const refreshBackups = useCallback(() => {
    window.api.listBackups().then(setBackups);
  }, []);

  useEffect(refreshBackups, [refreshBackups]);

  // Every switch on this page flips one boolean setting and writes it back, so
  // they share one handler. `also` is for the two that have somewhere else to
  // be: auto_start is acted on by the main process, remember_filters by the
  // pages already mounted.
  const toggle =
    (
      key: string,
      value: boolean,
      setValue: (next: boolean) => void,
      also?: (next: boolean) => void,
    ) =>
    async () => {
      const next = !value;
      setValue(next);
      also?.(next);
      await window.api.setSetting(key, String(next));
    };

  const handleSessionGroupingChange = useCallback(async (next: SessionGrouping) => {
    setSessionGrouping(next);
    await window.api.setSetting(SESSION_GROUPING_SETTING, next);
  }, []);

  const errorWith = useCallback((error: string) => t("settings.errorWith", { error }), [t]);

  const handleBackupNow = useCallback(async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const result = await window.api.createBackup();
      setBackupStatus(
        result.success
          ? t("settings.backedUp", { count: result.backup?.games ?? 0 })
          : errorWith(result.error ?? t("settings.backupFailed")),
      );
      refreshBackups();
    } catch (err: any) {
      setBackupStatus(errorWith(err.message));
    } finally {
      setBackupBusy(false);
    }
  }, [refreshBackups, t, errorWith]);

  const handleRestore = useCallback(
    async (file: string) => {
      setConfirmRestore(null);
      setBackupBusy(true);
      setBackupStatus(null);
      try {
        const result = await window.api.restoreBackup(file);
        setBackupStatus(
          result.success
            ? t("settings.restored", { count: result.games ?? 0, file })
            : errorWith(result.error ?? t("settings.restoreFailed")),
        );
        refreshBackups();
      } catch (err: any) {
        setBackupStatus(errorWith(err.message));
      } finally {
        setBackupBusy(false);
      }
    },
    [refreshBackups, t, errorWith],
  );

  const handleExport = useCallback(async () => {
    setExportStatus(null);
    try {
      const result = await window.api.exportData();
      if (result.success) {
        setExportStatus(
          t("settings.exported", { count: result.games ?? 0, path: result.path ?? "" }),
        );
      } else {
        // No error means the file dialog was dismissed, which needs no message
        setExportStatus(result.error ? errorWith(result.error) : null);
      }
    } catch (err: any) {
      setExportStatus(errorWith(err.message));
    }
  }, [t, errorWith]);

  useEffect(() => window.api.onImportProgress(setImportProgress), []);

  const handleImport = useCallback(async () => {
    setImportStatus(null);
    setImporting(true);
    try {
      const result = await window.api.importData();
      if (result.success) {
        setImportStatus(t("settings.importedNew", { count: result.imported ?? 0 }));
      } else {
        setImportStatus(result.error ? errorWith(result.error) : null);
      }
      // An import takes a snapshot on its way in
      refreshBackups();
    } catch (err: any) {
      setImportStatus(errorWith(err.message));
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }, [refreshBackups, t, errorWith]);

  // A run in progress reports how far it has got; the outcome takes over once
  // it is done
  const backfillLine = progress
    ? progress.total === 0
      ? t("settings.nothingNew")
      : t("settings.checking", {
          current: progress.current,
          total: progress.total,
          added: progress.added,
        })
    : backfillStatus;

  // Like the backfill line: how far the import has got while it runs, then the
  // outcome
  const importLine =
    importing && importProgress
      ? t("settings.importing", {
          current: importProgress.current,
          total: importProgress.total,
          imported: importProgress.imported,
        })
      : importStatus;

  const handleBackfill = useCallback(async () => {
    setBackfillStatus(t("settings.fetchingList"));
    try {
      const result = await window.api.backfillHistory();
      if ("error" in result) {
        setBackfillStatus(errorWith(result.error));
      } else {
        const summary =
          result.added > 0
            ? t("settings.backfillAdded", { added: result.added, scanned: result.scanned })
            : t("settings.backfillNone", { scanned: result.scanned });
        setBackfillStatus(
          result.cancelled
            ? t("settings.backfillStopped", { added: result.added })
            : result.limit === "service"
              ? t("settings.backfillService", { summary, cap: SGP_HISTORY_CAP })
              : result.limit === "paging"
                ? t("settings.backfillPaging", { summary, scanned: result.scanned })
                : summary,
        );
      }
    } catch (err: any) {
      setBackfillStatus(errorWith(err.message));
    }
  }, [t, errorWith]);

  const handleRepair = useCallback(async () => {
    setRepairStatus(null);
    try {
      const result = await window.api.repairPuuids();
      setRepairStatus(
        t("settings.repaired", {
          games: result.repairedGames,
          accounts: result.discoveredAccounts,
          rebuilt: result.rebuiltGames,
        }),
      );
      // A repair takes a snapshot on its way in
      refreshBackups();
    } catch (err: any) {
      setRepairStatus(errorWith(err.message));
    }
  }, [refreshBackups, t, errorWith]);

  if (loading) return null;

  const actionButton =
    "px-4 py-1.5 rounded text-sm bg-lol-gold/20 text-lol-gold hover:bg-lol-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-lol-text-bright">{t("settings.title")}</h1>

      {/* General */}
      <div className="bg-lol-card rounded-xl border border-lol-border/60 p-5">
        <h2 className="text-sm font-semibold text-lol-text-bright mb-4">{t("settings.general")}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.language")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.languageDesc")}</p>
            </div>
            <select
              className="select shrink-0"
              value={languageChoice}
              onChange={(e) => void setLanguageChoice(e.target.value as LanguageChoice)}
            >
              {LANGUAGE_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {t(`language.${choice}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.autoStart")}</p>
              <p className="text-xs text-lol-text mt-0.5">
                {t("settings.autoStartDesc")}
                {!autoStartSupported && t("settings.autoStartOnlyPackaged")}
              </p>
            </div>
            <Switch
              checked={autoStart}
              onChange={toggle("auto_start", autoStart, setAutoStart)}
              disabled={!autoStartSupported}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.minimizeToTray")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.minimizeToTrayDesc")}</p>
            </div>
            <Switch
              checked={minimizeToTray}
              onChange={toggle("minimize_to_tray", minimizeToTray, setMinimizeToTray)}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.openOnClient")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.openOnClientDesc")}</p>
            </div>
            <Switch
              checked={openOnClient}
              onChange={toggle(OPEN_ON_CLIENT_SETTING, openOnClient, setOpenOnClient)}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.leagueShortcut")}</p>
              <p className="text-xs text-lol-text mt-0.5">
                {leagueShortcutSupported
                  ? t("settings.leagueShortcutDesc")
                  : t("settings.leagueShortcutUnsupported")}
              </p>
              {shortcutStatus && (
                <p className="text-xs text-lol-gold mt-1" role="status">
                  {shortcutStatus}
                </p>
              )}
            </div>
            <button
              onClick={handleLeagueShortcut}
              disabled={!leagueShortcutSupported}
              className={`${actionButton} shrink-0 whitespace-nowrap`}
            >
              {t("settings.leagueShortcutButton")}
            </button>
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.rememberFilters")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.rememberFiltersDesc")}</p>
            </div>
            <Switch
              checked={rememberFilters}
              onChange={toggle(
                "remember_filters",
                rememberFilters,
                setRememberFilters,
                setRemembering,
              )}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.hideRemakes")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.hideRemakesDesc")}</p>
            </div>
            <Switch
              checked={hideRemakes}
              onChange={toggle("hide_remakes", hideRemakes, setHideRemakes)}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.gameNotice")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.gameNoticeDesc")}</p>
            </div>
            <Switch
              checked={gameNotice}
              onChange={toggle(GAME_NOTICE_SETTING, gameNotice, setGameNotice)}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.gameNoticeObs")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.gameNoticeObsDesc")}</p>
            </div>
            <Switch
              checked={gameNoticeObs}
              disabled={!gameNotice}
              onChange={toggle(GAME_NOTICE_OBS_SETTING, gameNoticeObs, setGameNoticeObs)}
            />
          </div>

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.grouping")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.groupingDesc")}</p>
            </div>
            <select
              className="select shrink-0"
              value={sessionGrouping}
              onChange={(e) => handleSessionGroupingChange(e.target.value as SessionGrouping)}
            >
              {SESSION_GROUPING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`grouping.${option}`)}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs text-lol-text">{t("settings.queueNote")}</p>
        </div>
      </div>

      {/* Sidebar */}
      <div className="bg-lol-card rounded-xl border border-lol-border/60 p-5">
        <h2 className="text-sm font-semibold text-lol-text-bright mb-1">{t("settings.sidebar")}</h2>
        <p className="text-xs text-lol-text mb-4">{t("settings.sidebarDesc")}</p>
        <div className="space-y-1">
          {navLayout.order.map((id, index) => {
            const label = t(`nav.${id}`);
            const hidden = navLayout.hidden.includes(id);
            return (
              <div key={id} className="flex items-center gap-3 py-1">
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label={t("settings.moveUp", { label })}
                    disabled={index === 0}
                    onClick={() => void saveNavLayout(moveNavItem(navLayout, id, -1))}
                    className="px-1 text-[10px] leading-none text-lol-text hover:text-lol-text-bright disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={t("settings.moveDown", { label })}
                    disabled={index === navLayout.order.length - 1}
                    onClick={() => void saveNavLayout(moveNavItem(navLayout, id, 1))}
                    className="px-1 text-[10px] leading-none text-lol-text hover:text-lol-text-bright disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ▼
                  </button>
                </div>
                <span
                  className={`flex-1 text-sm ${hidden ? "text-lol-text" : "text-lol-text-bright"}`}
                >
                  {label}
                </span>
                <Switch
                  checked={!hidden}
                  onChange={() => void saveNavLayout(setNavItemHidden(navLayout, id, !hidden))}
                />
              </div>
            );
          })}
        </div>

        <div className="border-t border-lol-border my-4" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-lol-text-bright">{t("settings.startPage")}</p>
            <p className="text-xs text-lol-text mt-0.5">{t("settings.startPageDesc")}</p>
          </div>
          <select
            className="select shrink-0"
            value={homePath}
            onChange={(e) => void saveHomePath(e.target.value)}
          >
            {visibleNavItems(navLayout).map((item) => (
              <option key={item.id} value={item.path}>
                {t(`nav.${item.id}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="bg-lol-card rounded-xl border border-lol-border/60 p-5">
        <h2 className="text-sm font-semibold text-lol-text-bright mb-1">
          {t("settings.shortcuts")}
        </h2>
        <p className="text-xs text-lol-text mb-4">{t("settings.shortcutsDesc")}</p>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-lol-text-bright">{t("settings.shortcutsTabs")}</dt>
            <dd>
              <Keys>1 – 9</Keys>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-lol-text-bright">{t("settings.shortcutsSearch")}</dt>
            <dd>
              <Keys>Ctrl + F</Keys>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-lol-text-bright">{t("settings.shortcutsSync")}</dt>
            <dd>
              <Keys>Ctrl + R</Keys>
            </dd>
          </div>
        </dl>
      </div>

      {/* Data Management */}
      <div className="bg-lol-card rounded-xl border border-lol-border/60 p-5">
        <h2 className="text-sm font-semibold text-lol-text-bright mb-4">{t("settings.data")}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.backfill")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.backfillDesc")}</p>
            </div>
            <button onClick={handleBackfill} disabled={backfilling} className={actionButton}>
              {backfilling ? t("settings.working") : t("settings.backfillButton")}
            </button>
          </div>
          {backfillLine && <p className="text-xs text-lol-text">{backfillLine}</p>}

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.export")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.exportDesc")}</p>
            </div>
            <button onClick={handleExport} className={actionButton}>
              {t("settings.exportButton")}
            </button>
          </div>
          {exportStatus && <p className="text-xs text-lol-text">{exportStatus}</p>}

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.import")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.importDesc")}</p>
            </div>
            <button onClick={handleImport} disabled={importing} className={actionButton}>
              {importing ? t("settings.working") : t("settings.importButton")}
            </button>
          </div>
          {importLine && <p className="text-xs text-lol-text">{importLine}</p>}

          <div className="border-t border-lol-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.repair")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.repairDesc")}</p>
            </div>
            <button onClick={handleRepair} className={actionButton}>
              {t("settings.repairButton")}
            </button>
          </div>
          {repairStatus && <p className="text-xs text-lol-text">{repairStatus}</p>}
        </div>
      </div>

      {/* Backups */}
      <div className="bg-lol-card rounded-xl border border-lol-border/60 p-5">
        <h2 className="text-sm font-semibold text-lol-text-bright mb-4">{t("settings.backups")}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-lol-text-bright">{t("settings.autoBackup")}</p>
              <p className="text-xs text-lol-text mt-0.5">{t("settings.autoBackupDesc")}</p>
            </div>
            <Switch
              checked={autoBackup}
              onChange={toggle("auto_backup", autoBackup, setAutoBackup)}
            />
          </div>

          <div className="border-t border-lol-border" />

          {backups.length === 0 ? (
            <p className="text-xs text-lol-text">{t("settings.noBackups")}</p>
          ) : (
            <div className="space-y-1">
              {backups.map((backup) => (
                <div
                  key={backup.file}
                  className="flex items-center justify-between gap-3 text-xs py-1"
                >
                  <div className="min-w-0">
                    <p className="text-lol-text-bright">{formatTaken(backup.created)}</p>
                    <p className="text-lol-text">
                      {backupReason(t, backup.reason)} ·{" "}
                      {backup.games === null
                        ? t("settings.unreadable")
                        : t("settings.gamesCount", { count: backup.games })}{" "}
                      · {formatSize(backup.size)}
                    </p>
                  </div>
                  {confirmRestore === backup.file ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-lol-text">{t("settings.replaceCurrent")}</span>
                      <button
                        onClick={() => handleRestore(backup.file)}
                        disabled={backupBusy}
                        className="px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {t("settings.restore")}
                      </button>
                      <button
                        onClick={() => setConfirmRestore(null)}
                        className="px-3 py-1 rounded bg-lol-border/40 text-lol-text hover:bg-lol-border/60 transition-colors"
                      >
                        {t("settings.cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRestore(backup.file)}
                      disabled={backupBusy || backup.games === null}
                      className="px-3 py-1 rounded shrink-0 bg-lol-gold/20 text-lol-gold hover:bg-lol-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t("settings.restore")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={handleBackupNow} disabled={backupBusy} className={actionButton}>
              {backupBusy ? t("settings.working") : t("settings.backupNow")}
            </button>
            <button
              onClick={() => window.api.openBackupFolder()}
              className="px-4 py-1.5 rounded text-sm bg-lol-border/40 text-lol-text hover:bg-lol-border/60 transition-colors"
            >
              {t("settings.openFolder")}
            </button>
          </div>
          {backupStatus && <p className="text-xs text-lol-text">{backupStatus}</p>}
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="bg-lol-card rounded-xl border border-lol-border/60 p-5">
        <h2 className="text-sm font-semibold text-lol-text-bright mb-4">
          {t("settings.troubleshooting")}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-lol-text-bright">{t("settings.logFile")}</p>
            <p className="text-xs text-lol-text mt-0.5">{t("settings.logFileDesc")}</p>
          </div>
          <button
            onClick={() => window.api.openLogsFolder()}
            className="px-4 py-1.5 rounded text-sm shrink-0 bg-lol-border/40 text-lol-text hover:bg-lol-border/60 transition-colors"
          >
            {t("settings.openFolder")}
          </button>
        </div>
      </div>
    </div>
  );
}
