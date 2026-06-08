// Fase 0 data pipeline: generate synthetic NBA-like seasons with a plausible quality
// spread, then run the SAME valuation the real pipeline will use. Output is committed
// JSON under /data/seasons/{year}.json. Engine loads these exactly as it will load real
// data → Fase 1 becomes a pure data swap.
//
// Deterministic: seeded per season, so regenerating yields identical files.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../../src/engine/rng';
import { defaultValuation, type RawPlayer } from '../../src/engine/valuation';
import type { Position, SeasonData } from '../../src/types';
import { POSITIONS } from '../../src/types';
import { SIM } from '../../src/config/gameConstants';

const SEASONS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const TEAMS_PER_SEASON = 30;
const PLAYERS_PER_TEAM = 15;

const FIRST_NAMES = [
  'James', 'Marcus', 'Tyler', 'DeAndre', 'Jalen', 'Cole', 'Brandon', 'Isaiah',
  'Trey', 'Malik', 'Devin', 'Kobe', 'Andre', 'Jaylen', 'Cameron', 'Darius',
  'Anthony', 'Donovan', 'Keegan', 'Bennedict', 'Franz', 'Paolo', 'Evan', 'Tre',
  'Immanuel', 'Quentin', 'Naz', 'Obi', 'Santi', 'Walker', 'Bones', 'Davion',
  'Jeremiah', 'Trayce', 'Aaron', 'Grayson', 'Killian', 'Moses', 'Onyeka', 'Pat',
];
const LAST_NAMES = [
  'Carter', 'Reed', 'Brooks', 'Hunter', 'Mitchell', 'Banks', 'Foster', 'Reeves',
  'Coleman', 'Bridges', 'Holmes', 'Vance', 'Walsh', 'Porter', 'Knox', 'Crowder',
  'Sumner', 'Greene', 'Murray', 'Sharpe', 'Wagner', 'Banchero', 'Mobley', 'Jones',
  'Quickley', 'Grimes', 'Reid', 'Toppin', 'Aldama', 'Kessler', 'Hyland', 'Mitchell',
  'Robinson', 'Jackson', 'Gordon', 'Allen', 'Hayes', 'Moody', 'Okeke', 'Williams',
];

function teamCode(i: number): string {
  // simple deterministic 3-letter codes TM00..TM29
  return `TM${String(i).padStart(2, '0')}`;
}

function generateSeason(season: number): SeasonData {
  const rng = createRng(`fake-data-${season}`);
  const raw: RawPlayer[] = [];
  const rostersByTeam: Record<string, string[]> = {};
  const teamQuality: Record<string, number> = {};

  for (let t = 0; t < TEAMS_PER_SEASON; t++) {
    const team = teamCode(t);
    rostersByTeam[team] = [];
    for (let s = 0; s < PLAYERS_PER_TEAM; s++) {
      // latent skill: standard normal, with a rare top-tail boost for would-be stars.
      let skill = rng.gaussian(0, 1);
      if (rng.chance(0.03)) skill += rng.range(1.5, 3.5); // rare superstar tail

      // advanced metrics derived from latent skill, in realistic-ish ranges.
      const bpm = clamp(-4 + 4 * skill, -8, 13);
      // availability: most play a lot, some get hurt.
      const gamesPlayed = Math.round(
        clamp(rng.gaussian(68, 12) - (rng.chance(0.12) ? rng.range(15, 45) : 0), 8, 82),
      );
      const availability = gamesPlayed / SIM.GAMES;
      const vorp = Math.max(0, (bpm + 2) * availability * 0.5);

      const position = POSITIONS[rng.int(0, POSITIONS.length - 1)] as Position;
      const offSplit = clamp(rng.gaussian(0.5, 0.08), 0.3, 0.7);

      // cosmetic box-score stats, loosely tied to skill and position.
      const scoring = clamp(6 + skill * 5 + rng.range(-2, 3), 1, 36);
      const fn = FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)];
      const ln = LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)];
      const idx = raw.length;
      const id = `${season}-${slug(fn)}-${slug(ln)}-${idx}`;

      raw.push({
        id,
        name: `${fn} ${ln}`,
        team,
        season,
        position,
        ppg: round1(scoring),
        rpg: round1(clamp((position === 'C' || position === 'PF' ? 7 : 3) + skill * 1.5 + rng.range(-1, 1), 0.5, 15)),
        apg: round1(clamp((position === 'PG' ? 5 : 2) + skill * 1.2 + rng.range(-1, 1), 0.2, 12)),
        gamesPlayed,
        bpm: round1(bpm),
        vorp: round1(vorp),
        offSplit: round2(offSplit),
      });
      rostersByTeam[team].push(id);
    }
  }

  // valuate the whole season (quality, tradeValue 1–100, per-season tiers).
  const players = defaultValuation.valuateSeason(raw);
  const qualityById = new Map(players.map((p) => [p.id, p.quality]));
  for (const team of Object.keys(rostersByTeam)) {
    teamQuality[team] = rostersByTeam[team].reduce(
      (sum, id) => sum + (qualityById.get(id) ?? 0),
      0,
    );
  }

  // actualWins correlated to team total quality + noise, scaled to sum ≈ 82*30/2.
  const qVals = Object.values(teamQuality);
  const qMin = Math.min(...qVals);
  const qMax = Math.max(...qVals);
  const qSpan = qMax - qMin || 1;
  const originalRosters: SeasonData['originalRosters'] = {};
  for (const team of Object.keys(rostersByTeam)) {
    const norm = (teamQuality[team] - qMin) / qSpan; // 0..1
    const wins = Math.round(
      clamp(15 + norm * 52 + rng.gaussian(0, 5), 10, 73),
    );
    originalRosters[team] = {
      team,
      playerIds: rostersByTeam[team],
      actualWins: wins,
    };
  }

  return { season, players, originalRosters };
}

// helpers
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// --- run ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../../data/seasons');
mkdirSync(outDir, { recursive: true });

for (const season of SEASONS) {
  const data = generateSeason(season);
  const file = resolve(outDir, `${season}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  const tiers = data.players.reduce<Record<string, number>>((acc, p) => {
    acc[p.tier] = (acc[p.tier] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `season ${season}: ${data.players.length} players`,
    tiers,
    `→ ${file.replace(process.cwd() + '/', '')}`,
  );
}
console.log('Done.');
