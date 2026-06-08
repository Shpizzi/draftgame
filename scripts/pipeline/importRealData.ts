// Fase 1 data pipeline: import REAL data from the Kaggle "NBA, ABA, BAA Stats"
// dataset (sumitrodatta, CC BY-SA 4.0, sourced from Basketball-Reference) into the
// exact same JSON shape the engine already consumes. Engine/UI/tests don't change —
// this is a pure data swap on top of the synthetic Fase 0 data.
//
// Source CSVs live in /archive. Output → /data/seasons/{year}.json (committed).
// Deterministic and rng-free: this only reads, normalizes, and valuates.
//
// Attribution required by CC BY-SA: data from Basketball-Reference via the Kaggle
// dataset github.com/sumitrodatta/nba-aba-baa-stats.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultValuation, type RawPlayer } from '../../src/engine/valuation';
import type { Position, SeasonData } from '../../src/types';
import { POSITIONS } from '../../src/types';
import { SIM } from '../../src/config/gameConstants';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARCHIVE = resolve(__dirname, '../../archive');
const OUT = resolve(__dirname, '../../data/seasons');

const FIRST_SEASON = 1984; // "fino dall'84" — BPM/VORP exist from 1973-74, so 1984 is safe.
const LAST_SEASON = 2026;
const SEASONS = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, i) => FIRST_SEASON + i,
);

// Real schedule length only for the seasons that were NOT 82 games — strike/COVID years.
// Everything else defaults to 82 (DEFAULT_SCHEDULE). Used to normalize games played to an
// 82-game equivalent so availability is fair and the engine can keep SIM.GAMES = 82.
// NBA-specific knowledge → lives in the pipeline only.
const DEFAULT_SCHEDULE = 82;
const SCHEDULE: Record<number, number> = {
  1999: 50, // lockout
  2012: 66, // lockout
  2020: 72, // COVID bubble
  2021: 72, // COVID
};

// --- tiny CSV parser (handles quoted fields with commas) ---
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const csv = (file: string) => parseCSV(readFileSync(resolve(ARCHIVE, file), 'utf8'));
const num = (v: string) => (v === '' || v === 'NA' ? 0 : Number(v));
const isMultiTeam = (team: string) => /^(TOT|\dTM)$/.test(team);
const primaryPos = (pos: string): Position => {
  const p = pos.split('-')[0] as Position;
  return POSITIONS.includes(p) ? p : 'SF';
};

interface RowGroup {
  combined?: Record<string, string>;
  teamRows: Record<string, string>[];
}

// Group rows of one stat file by (player_id, season), separating the combined
// multi-team row from per-team rows.
function groupByPlayerSeason(rows: Record<string, string>[]): Map<string, RowGroup> {
  const map = new Map<string, RowGroup>();
  for (const r of rows) {
    if (r.lg !== 'NBA') continue;
    const season = Number(r.season);
    if (!SEASONS.includes(season)) continue;
    const key = `${season}-${r.player_id}`;
    const g = map.get(key) ?? { teamRows: [] };
    if (isMultiTeam(r.team)) g.combined = r;
    else g.teamRows.push(r);
    map.set(key, g);
  }
  return map;
}

// Pick the full-season representative row (combined if traded, else the single row).
const repRow = (g: RowGroup): Record<string, string> | undefined =>
  g.combined ?? g.teamRows[0];

// The team a traded player is assigned to for the "original roster" (most games played).
function primaryTeam(g: RowGroup): string {
  if (g.teamRows.length === 0) return g.combined?.team ?? '';
  return [...g.teamRows].sort((a, b) => num(b.g) - num(a.g))[0].team;
}

function buildSeason(season: number): SeasonData {
  const advAll = csv('Advanced.csv');
  const pgAll = csv('Player Per Game.csv');
  const teams = csv('Team Summaries.csv').filter(
    (r) => r.lg === 'NBA' && Number(r.season) === season && r.team !== 'League Average',
  );

  const adv = groupByPlayerSeason(advAll);
  const pg = groupByPlayerSeason(pgAll);

  const raw: RawPlayer[] = [];
  const teamOfPlayer = new Map<string, string>(); // pool id → team abbrev

  for (const [key, g] of adv) {
    if (Number(key.split('-')[0]) !== season) continue;
    const a = repRow(g);
    if (!a) continue;
    const pgRow = repRow(pg.get(key) ?? { teamRows: [] });

    const schedule = SCHEDULE[season] ?? DEFAULT_SCHEDULE;
    const gamesNorm = Math.min(
      SIM.GAMES,
      Math.round((num(a.g) / schedule) * SIM.GAMES),
    );

    const obpm = num(a.obpm);
    const dbpm = num(a.dbpm);
    // offSplit: share of value that is offense. obpm>dbpm → more offensive.
    const offSplit = Math.max(0.3, Math.min(0.7, 0.5 + 0.04 * (obpm - dbpm)));

    const team = primaryTeam(g);
    const id = key; // `${season}-${player_id}` is unique per player-season

    raw.push({
      id,
      name: a.player,
      team,
      season,
      position: primaryPos(a.pos),
      ppg: num(pgRow?.pts_per_game ?? ''),
      rpg: num(pgRow?.trb_per_game ?? ''),
      apg: num(pgRow?.ast_per_game ?? ''),
      gamesPlayed: gamesNorm,
      bpm: num(a.bpm),
      vorp: num(a.vorp),
      offSplit: Math.round(offSplit * 100) / 100,
    });
    teamOfPlayer.set(id, team);
  }

  const players = defaultValuation.valuateSeason(raw);

  // originalRosters keyed by abbreviation; team stores the full name for display.
  const originalRosters: SeasonData['originalRosters'] = {};
  for (const t of teams) {
    const abbr = t.abbreviation;
    const playerIds = players.filter((p) => teamOfPlayer.get(p.id) === abbr).map((p) => p.id);
    originalRosters[abbr] = { team: t.team, playerIds, actualWins: num(t.w) };
  }

  return { season, players, originalRosters };
}

// --- run ---
mkdirSync(OUT, { recursive: true });
for (const season of SEASONS) {
  const data = buildSeason(season);
  writeFileSync(resolve(OUT, `${season}.json`), JSON.stringify(data, null, 2));
  const tiers = data.players.reduce<Record<string, number>>((acc, p) => {
    acc[p.tier] = (acc[p.tier] ?? 0) + 1;
    return acc;
  }, {});
  const teamsN = Object.keys(data.originalRosters).length;
  console.log(`season ${season}: ${data.players.length} players, ${teamsN} teams`, tiers);
}
console.log('Done. Source: Basketball-Reference via Kaggle (sumitrodatta/nba-aba-baa-stats, CC BY-SA 4.0).');
