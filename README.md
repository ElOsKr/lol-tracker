# LoLeanding

Desktop app that keeps **your** League of Legends match history on **your** machine, forever, and helps you understand your games. It reads the League Client you already have open — no account, no server, no ads.

<img width="1280" height="820" alt="image" src="https://github.com/user-attachments/assets/cdce7dae-d96e-4be0-8d0a-bf9c7ee245d3" />

## Why it exists

Riot only serves an account's **last 1000 matches**. Everything LoLeanding captures stays, so your history outlives that window — and every number it shows is measured against one of two baselines it can actually see: **the other nine players in your own game**, or **your own games against each other**. It never pretends to compare you against a population it does not have.

## Features

- **Every League queue.** Ranked, normals, ARAM, Clash, bots, rotating modes, Arena, co-op, practice and customs. TFT is tracked separately and is not included yet.
- **Match history** grouped into sessions, with per-queue columns: the score in ARAM Chaos, CS and vision on the Rift.
- **Match detail**: damage split by type, damage taken and mitigated, crowd control, objectives, vision, farming, runes, bans and team objectives — plus a gold chart and a kill map drawn on the game's own minimap.
- **Data explorer**: pick a metric and a grouping (champion, teammate, patch, week, month, weekday, hour, game length, queue) and get the table. Rows whose difference the sample cannot support are printed in grey rather than coloured.
- **Skill profile**: six axes in every queue — aggression, damage, toughness, survival, control, economy — plus vision and farming where the map has them, each a percentile inside your own game.
- **Live game**: scoreboard while you play, with your own record _with_, _beside_ and _against_ every champion in the lobby, and a recap when it ends.
- **An ARAM Chaos score** out of 10 and your 1st–10th placing in the lobby. It is our own experimental formula, not a Riot grade.
- **Champion, item and augment catalogues**, your records, trends with patch markers, teammates, and Riot's challenges with weekly progress.
- **Widget**: a desktop window or an OBS browser source, with four themes, a custom accent colour and two densities, all settable from the URL.
- **Local SQLite**, with automatic backups and PNG export of any game.

## Download

Grab `LoLeanding.exe` from the [latest release](https://github.com/ElOsKr/lol-tracker/releases/latest) and run it. The app checks GitHub for new releases and offers to update itself.

## Usage

1. Start the League client and sign in. The app talks to the client's local API, so the client has to be running for it to detect your account, import history, or record new games.
2. Launch LoLeanding. The sidebar shows the connection status once it finds the client.
3. The first time an account connects it imports your past games, as far back as Riot's 1000-match window reaches. A large import takes a few minutes and fills the app in as it runs.
4. After that it records each game as you finish it, so leave it running while you play.

Re-run the import at any time from **Settings → Backfill match history**, which is also how you finish one you cancelled. Stored games stay readable with the client closed; only importing and recording need it open.

Match data lives in `%APPDATA%\loleanding\data`, with automatic backups alongside it. An install from before the rename keeps working: on first launch the app moves its games and backups over from `%APPDATA%\mayhem-tracker`.

## Tech Stack

Electron + React + TypeScript, built with electron-vite. Tailwind CSS for styling, better-sqlite3 for local storage, league-connect for LCU integration. Only two runtime dependencies; everything else is a dev tool.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what is planned and, just as usefully, what was measured and dropped.

## Development

```bash
npm install
npm run dev       # start in dev mode
```

better-sqlite3 ships prebuilt Node-API binaries, so there is no native module to rebuild for Electron. The Electron binary itself downloads the first time `npm run dev` needs it.

These run on pull requests, again before a tagged release, and locally via `preversion`, so `npm version` will not tag a tree that fails them:

```bash
npm run typecheck
npm run lint
npm run format    # rewrites in place; format:check only reports
npm test          # the suite
npm run test:aram # the ones that need Electron's Node and real SQLite
```

In development the database lives in `data/` and backups in `backups/`, both out of Git. Production uses Electron's userData directory.

## Build

```bash
npm run dist      # build the Windows executable
```

## Credits

Built on [Yhprum/mayhem-tracker](https://github.com/Yhprum/mayhem-tracker), whose MIT licence and attribution are preserved. This repository is a fork of it rather than a copy, so the original project gets visible credit.

## Disclaimer

LoLeanding was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
