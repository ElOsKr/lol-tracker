// English is the reference: every key the interface uses lives here, and the
// type of this object is what the other languages must satisfy.
export const en = {
  "language.system": "Match Windows",
  "language.en": "English",
  "language.es": "Spanish",

  // Sidebar
  "nav.history": "Match History",
  "nav.live": "Live Game",
  "nav.champions": "Champions",
  "nav.augments": "Augments",
  "nav.friends": "Friends",
  "nav.trends": "Trends",
  "nav.records": "Records",
  "nav.widget": "Widget / OBS",
  "nav.challenges": "Challenges",
  "nav.global": "Total Stats",
  "nav.settings": "Settings",
  "sidebar.tracker": "Tracker",
  "sidebar.sync": "Sync",
  "sidebar.syncing": "Syncing...",
  "sidebar.cancel": "Cancel",
  "sidebar.importing": "Importing history...",
  "sidebar.importingProgress": "Importing history {current}/{total}",
  "sidebar.importFailed": "Import failed: {error}",
  "sidebar.importStopped": "Import stopped after {count} game(s)",
  "sidebar.imported": "Imported {count} past game(s)",
  "sidebar.foundNew": "Found {count} new game(s)",
  "sidebar.noNew": "No new games",
  "sidebar.error": "Error: {error}",
  "sidebar.updateAvailable": "v{version} available",
  "status.connected": "Connected",
  "status.ingame": "In Game",
  "status.connecting": "Connecting...",
  "status.disconnected": "Disconnected",

  // Window controls
  "window.minimize": "Minimize",
  "window.maximize": "Maximize",
  "window.restore": "Restore",
  "window.close": "Close",

  // Queue bar
  "queue.label": "Queue",
  "queue.saveFailed": "Could not save the queue",
  "queue.noAugments":
    "This queue does not use Mayhem augments. Choose ARAM Mayhem to see their stats.",

  // Update dialog
  "update.title": "Update Available",
  "update.body": "Version {latest} is available (you have {current}).",
  "update.downloading": "Downloading... {progress}%",
  "update.downloadingOf": "Downloading... {progress}% of {size} MB",
  "update.manual": "Download manually",
  "update.viewOnGithub": "View on GitHub",
  "update.notNow": "Not Now",
  "update.install": "Update & Restart",
  "update.installing": "Updating...",
  "update.failed": "Update failed",
  "update.noNotes": "No notes for this release.",
  "update.noDownload": "No download found for this release",
  "update.versionsSince": "{count} versions of changes since your install",
  "update.moreOnGithub": ", plus earlier ones on GitHub",

  // Settings
  "settings.title": "Settings",
  "settings.general": "General",
  "settings.language": "Language",
  "settings.languageDesc":
    'The language of the interface. "Match Windows" follows your system language and falls back to English.',
  "settings.autoStart": "Start with Windows",
  "settings.autoStartDesc":
    "Open the program in the system tray when you sign in to Windows, so your games are recorded without having to remember to start it.",
  "settings.autoStartOnlyPackaged": " Only available in the packaged program.",
  "settings.minimizeToTray": "Minimize to tray on close",
  "settings.minimizeToTrayDesc":
    "When enabled, the program can keep storing your games even when the window is closed. You can still close the program from the system tray.",
  "settings.rememberFilters": "Remember filters and sorting",
  "settings.rememberFiltersDesc":
    "Reopen every page with the filters, search, and sort order you last used. When off, each page starts on its defaults again every time the program opens.",
  "settings.hideRemakes": "Hide remakes",
  "settings.hideRemakesDesc":
    "Leave remade games out of the match history. They are still recorded, and were never counted toward your stats either way.",
  "settings.grouping": "Group match history by",
  "settings.groupingDesc":
    "Break the match list into sessions, each under a heading with its own record and averages. Days start at 5am; weeks run Monday to Sunday.",
  "grouping.day": "Day",
  "grouping.week": "Week",
  "grouping.patch": "Patch",
  "grouping.none": "Don't group",
  "settings.queueNote":
    "The queue is chosen in the selector at the top and is kept across restarts. Stats from different queues are never mixed.",
  "settings.sidebar": "Sidebar",
  "settings.sidebarDesc":
    "Choose which pages appear in the sidebar and in what order. Settings always stays, so you can come back here.",
  "settings.moveUp": "Move {label} up",
  "settings.moveDown": "Move {label} down",
  "settings.startPage": "Start page",
  "settings.startPageDesc":
    "The page that opens when the program starts. Only pages shown in the sidebar can be chosen.",
  "settings.data": "Data Management",
  "settings.backfill": "Backfill match history",
  "settings.backfillDesc":
    "Pull your available LoL games from Riot and add any that aren't stored yet. This runs automatically the first time an account connects; use this to run it again, or to finish an import you cancelled.",
  "settings.working": "Working...",
  "settings.backfillButton": "Backfill",
  "settings.export": "Export data",
  "settings.exportDesc": "Save all match data to a JSON file for backup",
  "settings.exportButton": "Export",
  "settings.import": "Import data",
  "settings.importDesc": "Load match data from a previously exported file",
  "settings.importButton": "Import",
  "settings.repair": "Repair account data",
  "settings.repairDesc":
    "Re-detect which accounts are yours by analyzing game history, then rebuild stored stats, augments, and performance scores from the raw game data. Use this if games are attributed to the wrong account or scores look stale.",
  "settings.repairButton": "Repair",
  "settings.backups": "Backups",
  "settings.autoBackup": "Automatic backups",
  "settings.autoBackupDesc":
    "Keep a daily copy of your database on this computer, plus one before any import or repair. Older copies thin out to weekly and monthly. If the database ever goes missing or won't open, the newest working copy is restored on startup.",
  "settings.noBackups": "No backups yet.",
  "backup.reason.auto": "Scheduled",
  "backup.reason.manual": "Manual",
  "backup.reason.pre-import": "Before import",
  "backup.reason.pre-repair": "Before repair",
  "backup.reason.pre-restore": "Before restore",
  "settings.unreadable": "unreadable",
  "settings.gamesCount": "{count} games",
  "settings.replaceCurrent": "Replace current data?",
  "settings.restore": "Restore",
  "settings.cancel": "Cancel",
  "settings.backupNow": "Back up now",
  "settings.openFolder": "Open folder",
  "settings.backedUp": "Backed up {count} game(s)",
  "settings.errorWith": "Error: {error}",
  "settings.backupFailed": "backup failed",
  "settings.restored": "Restored {count} game(s) from {file}",
  "settings.restoreFailed": "restore failed",
  "settings.exported": "Exported {count} game(s) to {path}",
  "settings.importedNew": "Imported {count} new game(s)",
  "settings.nothingNew": "Nothing new to check",
  "settings.checking": "Checking game {current} of {total}, {added} added so far",
  "settings.fetchingList": "Fetching your match list from Riot...",
  "settings.backfillAdded": "Added {added} game(s) from {scanned} found in your Riot history",
  "settings.backfillNone": "No new LoL games found ({scanned} games checked)",
  "settings.backfillStopped": "Stopped after adding {added} game(s). Run it again to finish.",
  "settings.backfillService":
    "{summary}. Riot only serves your most recent {cap} games of any queue, so nothing older can be imported — but every new game from here on is kept.",
  "settings.backfillPaging":
    "{summary}. Stopped at the {scanned}-game paging limit, so anything older was not checked.",
  "settings.repaired":
    "Repaired {games} game(s), found {accounts} account(s), rebuilt stats and scores for {rebuilt} game(s)",
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Record<TranslationKey, string>;
