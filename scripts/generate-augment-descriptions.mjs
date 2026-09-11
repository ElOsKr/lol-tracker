// Regenerates src/main/augment-descriptions.json, the Mayhem augment tooltip
// text bundled into the main process, and src/renderer/texticons.json, the
// inline stat glyphs that text refers to.
//
// Run it when augments change:  npm run gen:augments
//
// Why a build step and not a fetch at runtime: unlike items, whose descriptions
// arrive fully formed in the items.json the app already loads per patch,
// augment text is assembled from two large game-data exports —
//
//   kiwi.bin.json         12MB  Mayhem's mode data. "Kiwi" is the mode's
//                               codename; its AugmentData entries carry the
//                               platform id the rest of the app keys on, a loc
//                               key for the description, and the spell whose
//                               DataValues fill that description's blanks.
//   lol.stringtable.json  32MB  every localized string in the game, including
//                               the text those loc keys point at.
//
// 44MB per patch branch is not something to make users download to read a
// tooltip; distilled to id -> text it is about 35KB, so it ships in the bundle
// instead. The tradeoff is that the text is current as of the last time this
// ran rather than per-patch — acceptable for prose, which is why augment NAMES,
// rarities and icons still come from the per-patch fetch in dragon.ts, where
// being wrong about a reworked augment would misreport what was played.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src", "main", "augment-descriptions.json");
const ICONS_OUT = path.join(ROOT, "src", "renderer", "texticons.json");
const CDRAGON = "https://raw.communitydragon.org";

// A branch only ships the augments in its own rotation, so "latest" alone
// leaves out everything Riot has since cycled or retired — 32 of 170 when this
// was written, Self Destruct and The Brutalizer among them. Walking back picks
// them up, the same way resolveAugmentIcon() digs their art out of the
// branches where they shipped. One patch back recovered 30 of those 32; the cap
// is what stops a permanently-absent augment from pulling down a year of 12MB
// manifests.
const MAX_BRANCH_LOOKBACK = 12;

const kiwiBinUrl = (branch) => `${CDRAGON}/${branch}/game/maps/modespecificdata/kiwi.bin.json`;

async function fetchJson(url, label) {
  process.stdout.write(`  ${label} … `);
  const res = await fetch(url, { headers: { "User-Agent": "MayhemTracker-build/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  console.log(`${(text.length / 1e6).toFixed(1)}MB`);
  return JSON.parse(text);
}

// Numeric patch branches, newest first — "latest" and "pbe" are handled
// separately and the rest are per-locale mirrors.
async function archivedBranches() {
  const listing = await fetchJson(`${CDRAGON}/json/`, "branch listing");
  return (Array.isArray(listing) ? listing : [])
    .map((entry) => String(entry?.name ?? ""))
    .filter((name) => /^\d+\.\d+$/.test(name))
    .sort((a, b) => {
      const [aMajor, aMinor] = a.split(".").map(Number);
      const [bMajor, bMinor] = b.split(".").map(Number);
      return bMajor - aMajor || bMinor - aMinor;
    });
}

// AugmentData entries are scattered through the bin rather than held in one
// list, so collect them wherever they appear.
function collectAugments(bin) {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (!Array.isArray(node) && node.__type === "AugmentData") found.push(node);
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(bin);
  return found;
}

// A formula that is one constant is worth reading; anything that scales with
// level or stats has no single number to print, and is left to the caller to
// drop. (ByCharLevelBreakpoints, ProductOfSubParts and friends land here.)
function constantCalculation(calc) {
  const parts = calc?.mFormulaParts;
  if (!Array.isArray(parts) || parts.length !== 1) return undefined;
  const part = parts[0];
  return part?.__type === "NumberCalculationPart" ? part.mNumber : undefined;
}

// Everything an augment's description can refer to, in the order the game
// resolves it: the spell's own data values first, then its calculations, then
// the handful of scalar spell fields that get named directly.
//
// Entries are { value, percent }: a GameCalculation can be flagged
// mDisplayAsPercent, meaning the game prints 0.3 as "30%" and the loc string
// says plain "@SpinDamageAmp@" rather than the usual "@SpinDamageAmp*100@%".
function valuesFor(augment, bin) {
  const values = new Map();
  const spells = [augment.RootSpell, ...(augment.AdditionalSpells ?? [])].filter(Boolean);
  const put = (name, value, percent) => {
    const key = String(name).toLowerCase();
    if (!values.has(key)) values.set(key, { value, percent });
  };
  for (const spellPath of spells) {
    const spell = bin[spellPath]?.mSpell;
    if (!spell) continue;
    for (const value of spell.DataValues ?? []) {
      put(value.name, value.values?.[0], false);
    }
    for (const [name, calc] of Object.entries(spell.mSpellCalculations ?? {})) {
      const constant = constantCalculation(calc);
      if (constant !== undefined) put(name, constant, calc?.mDisplayAsPercent === true);
    }
    const cooldown = spell.Cooldown ?? spell.cooldownTime;
    if (typeof cooldown === "number") put("cooldown", cooldown, false);
  }
  return values;
}

// The bin export only keeps a field name when it is in Riot's known-hashes
// list; everything else survives as "{90a024ae}", the FNV-1a 32 of the
// lowercased name. Hashing the name a placeholder asks for recovers the match —
// SpinDamageAmp_Ult on 16.18 is one such calculation.
function binHash(name) {
  let hash = 0x811c9dc5;
  for (const char of name.toLowerCase()) {
    hash = (Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0) >>> 0;
  }
  return `{${hash.toString(16).padStart(8, "0")}}`;
}

function formatNumber(value) {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

// Strings can cite other strings: "{{ Item_Keyword_OnHit }}" stands in for the
// shared "On-Hit" phrasing. What comes back can carry its own placeholders, so
// this has to run before substitution — and can itself cite further strings,
// hence the passes. The cap is a cycle guard, not a depth requirement; two
// levels is the most the game data actually uses.
const REFERENCE = /\{\{\s*([^}\s]+)\s*\}\}/g;
const MAX_REFERENCE_PASSES = 4;

function expandReferences(text, strings) {
  let out = text;
  for (let pass = 0; pass < MAX_REFERENCE_PASSES && REFERENCE.test(out); pass++) {
    REFERENCE.lastIndex = 0;
    out = out.replace(REFERENCE, (whole, key) => strings[key.toLowerCase()] ?? "");
    REFERENCE.lastIndex = 0;
  }
  return out;
}

// "@SlowResist*100@%" — a value name, optionally scaled by a constant.
const PLACEHOLDER = /@([A-Za-z_][\w.]*)\s*(?:([*/])\s*([\d.]+))?@/g;

function substitute(text, values) {
  let unresolved = 0;
  const filled = text.replace(PLACEHOLDER, (whole, name, operator, operand) => {
    const entry = values.get(name.toLowerCase()) ?? values.get(binHash(name));
    const base = entry?.value;
    if (typeof base !== "number") {
      unresolved++;
      // Riot's own item descriptions ship with the number simply missing when
      // it can't be resolved ("restore Health per second"), so match that
      // rather than leaving @Placeholder@ on screen.
      return "";
    }
    // An explicit operator means the string is doing the scaling itself and
    // supplying its own "%", so it wins over the calculation's percent flag.
    if (operator === "*") return formatNumber(base * Number(operand));
    if (operator === "/") return formatNumber(base / Number(operand));
    return entry.percent ? `${formatNumber(base * 100)}%` : formatNumber(base);
  });
  // A dropped placeholder leaves the spaces that surrounded it behind, and the
  // punctuation that followed it stranded after one of them. "%i:scaleAH%" is
  // an icon marker rather than a percent sign trailing a number, so the space
  // in front of that one is Riot's own and has to survive.
  const tidied = filled
    .replace(/ {2,}/g, " ")
    .replace(/ ([.,])/g, "$1")
    .replace(/ %(?!i:)/g, "%");
  return { text: tidied, unresolved };
}

// Several strings end with the <br><br> that separated them from a section the
// export doesn't carry, which would render as empty space under the tooltip.
const EDGE_BREAKS = /^(?:<br\s*\/?>|\s)+|(?:<br\s*\/?>|\s)+$/gi;

function trimBreaks(text) {
  return text.replace(EDGE_BREAKS, "");
}

// Inline icons
//
// "%i:scaleAH%" asks the game's text renderer to draw a stat glyph mid-sentence.
// Riot keeps them as one 20x20 PNG per name under texticons/, addressed by the
// marker name lowercased, so the marker resolves to a file without a mapping
// table — only the category folder has to be searched for.
//
// They are a few hundred bytes each and the whole set the augments use is about
// 6KB, so they are inlined as data URIs and bundled rather than fetched: an
// icon sitting inside a sentence has nothing sensible to show while a request
// is in flight. Only the markers the descriptions actually use are downloaded;
// a marker Riot introduces next patch renders as nothing until this runs again,
// the same way RiotText already drops tags it doesn't know.
const TEXTICONS = `${CDRAGON}/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/fonts/texticons/lol`;
const ICON_CATEGORIES = ["statsicon", "gameplay", "champion", "challenges", "ranks"];
const ICON_MARKER = /%i:([A-Za-z0-9_]+)%/g;

async function listIconCategory(category) {
  try {
    const listing = await fetchJson(
      `${CDRAGON}/json/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/fonts/texticons/lol/${category}/`,
      `texticons/${category}`,
    );
    return (Array.isArray(listing) ? listing : [])
      .map((entry) => String(entry?.name ?? ""))
      .filter((name) => name.endsWith(".png"));
  } catch {
    return [];
  }
}

async function fetchIcons(descriptions) {
  const wanted = new Set();
  for (const text of Object.values(descriptions)) {
    for (const [, name] of text.matchAll(ICON_MARKER)) wanted.add(name.toLowerCase());
  }
  if (wanted.size === 0) return {};

  // One listing per category beats probing every name against every folder.
  const where = new Map();
  for (const category of ICON_CATEGORIES) {
    for (const file of await listIconCategory(category)) {
      const name = file.slice(0, -4).toLowerCase();
      if (!where.has(name)) where.set(name, `${category}/${file}`);
    }
  }

  const icons = {};
  const missing = [];
  for (const name of [...wanted].sort()) {
    const at = where.get(name);
    if (!at) {
      missing.push(name);
      continue;
    }
    const res = await fetch(`${TEXTICONS}/${at}`, {
      headers: { "User-Agent": "MayhemTracker-build/1.0" },
    });
    if (!res.ok) {
      missing.push(name);
      continue;
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    icons[name] = `data:image/png;base64,${bytes.toString("base64")}`;
  }
  console.log(`\n  inline icons:          ${Object.keys(icons).length}/${wanted.size} resolved`);
  if (missing.length) console.log(`  no texticon for:       ${missing.join(", ")}`);
  return icons;
}

// Any @Placeholder@ the regex above didn't recognise at all — a name with an
// operator we don't parse, say — would otherwise survive into the UI.
const ANY_PLACEHOLDER = /@[^@]+@/;

async function main() {
  console.log("Generating Mayhem augment descriptions\n");

  // One stringtable serves every branch: Riot keeps retired augments' strings
  // long after their data leaves the export, so the archived branches only have
  // to supply the id -> loc key -> spell mapping, not another 32MB of text.
  const [stringtable, cherry] = await Promise.all([
    fetchJson(
      `${CDRAGON}/latest/game/en_us/data/menu/en_us/lol.stringtable.json`,
      "en_us stringtable",
    ),
    fetchJson(
      `${CDRAGON}/latest/plugins/rcp-be-lol-game-data/global/default/v1/cherry-augments.json`,
      "cherry-augments",
    ),
  ]);
  const strings = stringtable.entries ?? {};

  // What the app can actually show: the Mayhem augment ids the live export
  // names. Whether they're all covered decides when the branch walk can stop.
  const wanted = new Set(
    (Array.isArray(cherry) ? cherry : Object.values(cherry ?? {}))
      .filter((aug) => String(aug?.augmentNameId ?? "").startsWith("ARAM_"))
      .map((aug) => Number(aug.id))
      .filter(Number.isFinite),
  );

  const descriptions = {};
  const unresolvedKeys = new Set();
  let partial = 0;
  let patch = "unknown";

  const harvest = (bin, branch) => {
    let added = 0;
    for (const augment of collectAugments(bin)) {
      const id = augment.AugmentPlatformId;
      // An older branch never overrides a newer one — the first branch to name
      // an augment is the most recent one that had it.
      if (!Number.isFinite(id) || id in descriptions) continue;
      const locKey = String(
        augment.DescriptionTra ?? augment.AugmentTooltipTra ?? "",
      ).toLowerCase();
      const raw = strings[locKey];
      if (!raw) {
        if (locKey) unresolvedKeys.add(locKey);
        continue;
      }
      const { text, unresolved } = substitute(
        expandReferences(raw, strings),
        valuesFor(augment, bin),
      );
      const cleaned = trimBreaks(text.replace(ANY_PLACEHOLDER, ""));
      if (!cleaned) continue;
      if (unresolved || ANY_PLACEHOLDER.test(text)) partial++;
      descriptions[id] = cleaned;
      added++;
    }
    const remaining = [...wanted].filter((id) => !(id in descriptions)).length;
    console.log(`    ${branch}: +${added} (${remaining} Mayhem augments still uncovered)`);
    return remaining;
  };

  const latest = await fetchJson(kiwiBinUrl("latest"), "kiwi.bin (latest)");
  patch = String(latest.version ?? "").trim() || (await resolveLivePatch());
  let remaining = harvest(latest, "latest");

  if (remaining > 0) {
    // The live patch has its own numbered branch as well, holding what
    // "latest" just supplied.
    const branches = (await archivedBranches())
      .filter((branch) => branch !== patch)
      .slice(0, MAX_BRANCH_LOOKBACK);
    for (const branch of branches) {
      let bin;
      try {
        bin = await fetchJson(kiwiBinUrl(branch), `kiwi.bin (${branch})`);
      } catch {
        // A branch without Mayhem data is not evidence about the augment.
        console.log(`    ${branch}: no kiwi.bin`);
        continue;
      }
      remaining = harvest(bin, branch);
      if (remaining === 0) break;
    }
  }

  fs.writeFileSync(OUT, JSON.stringify({ patch, descriptions }, null, 2) + "\n");

  const covered = [...wanted].filter((id) => id in descriptions).length;
  console.log(`\n  descriptions written:  ${Object.keys(descriptions).length}`);
  console.log(`  Mayhem augments:       ${covered}/${wanted.size} covered`);
  console.log(`  missing a value:       ${partial}`);
  if (unresolvedKeys.size) console.log(`  loc keys with no text: ${unresolvedKeys.size}`);

  const icons = await fetchIcons(descriptions);
  fs.writeFileSync(ICONS_OUT, JSON.stringify(icons, null, 2) + "\n");

  for (const out of [OUT, ICONS_OUT]) {
    console.log(
      `\nWrote ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)}KB)`,
    );
  }
}

async function resolveLivePatch() {
  try {
    const versions = await fetchJson(
      "https://ddragon.leagueoflegends.com/api/versions.json",
      "live patch",
    );
    return String(versions[0]).match(/^(\d+\.\d+)/)?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
