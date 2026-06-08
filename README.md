# 🏀 NBA Roster Draft

Single-player web minigame: **spin** a random historical NBA season → get **dealt** a random 12-player roster → optimize it with **3 constrained trades** → set your **rotation** → **simulate** the season for a W-L record, then see *exactly why* you got that result.

Inspired by SixRings (databallr), with a different loop: you play the hand you're dealt and optimize under scarcity, instead of drafting blind.

> **Status: Fase 1 in progress** — the full loop is playable end-to-end on **real NBA data (2020–2026)**, the engine is pure/deterministic/tested, and the core rotation dilemma is tuned and locked by tests. The Fase 0 → Fase 1 swap was pure data: engine, UI and tests were unchanged.

## Design principle (non-negotiable)

All randomness sits **before** the player's choices (the deal) or is **visible historical data** (real games-missed that season). The final result is always **explainable** from the choices made — never an opaque number. The sim has bounded variance with visible inputs.

## The core dilemma (tuned in Fase 0)

Rotation size (5–10) is the central decision, and it's **roster-dependent**:

- **Stars + weak depth** → go **short**: concentrating minutes on a few studs wins on the mean (measured: ~+2.6 wins r5 vs r10).
- **Balanced / deep roster** → the mean is flat, so go **wide** for consistency.
- A **risk/reward axis** sits on top everywhere: short rotations are high-variance (σ≈6.5 wins), wide rotations are steady (σ≈2.3). Behind and need a spike? Go short.

This is enforced by `tests/rotationDilemma.test.ts` so it can't silently regress.

## Architecture

Strict separation: **engine ↔ data ↔ UI**. The engine knows nothing about basketball — it consumes `PlayerSeason[]` + config and returns results.

```
data/seasons/*.json         # static season data (Fase 0: synthetic; Fase 1: real). Bundled, never fetched at runtime.
scripts/pipeline/           # one-shot data generation + calibration/measurement tools
  generateFakeData.ts       #   → writes data/seasons/{year}.json (npm run gen-data)
  calibrate.ts              #   logistic-midpoint calibration (npm run calibrate)
  sweepRotation.ts          #   measures the rotation dilemma across roster archetypes
src/
  engine/                   # PURE, deterministic given a seed. No Math.random, no React.
    rng.ts                  #   one seedable PRNG threaded through the whole run
    valuation.ts            #   quality + tradeValue + per-season tiers (swappable interface)
    wheel.ts                #   era-pack year selection
    rosterGenerator.ts      #   weighted-by-tier deal, position coverage at exactly 12
    tradeSystem.ts          #   acceptance curve + 2-for-1 resolution
    simulation.ts           #   strength → wins, fatigue, bounded injuries, scaled noise
    scoring.ts              #   absolute + relative (vs real roster) scoring
  config/gameConstants.ts   # EVERY tunable constant, each marked // TUNE
  state/useGame.ts          # React orchestration; holds the single run rng
  components/               # Wheel/RosterBoard/TradePanel/RotationPicker/SimReveal/InjuryReport/...
  data/loadSeasons.ts       # static JSON access
tests/                      # engine tests with fixed seeds
```

## Commands

```bash
npm run dev        # play locally (http://localhost:3000)
npm run build      # static production build
npm test           # engine test suite (18 tests, fixed-seed)
npm run gen-data   # regenerate data/seasons/*.json (deterministic)
npm run calibrate  # print rosterStrength/wins distribution
npx tsx scripts/pipeline/sweepRotation.ts   # measure the rotation dilemma
```

## Key open questions (brief §9) — current defaults

| Question | Fase 0 default | Where |
|---|---|---|
| Failed trade burns move or attempt? | **burns the move** | `TRADE.FAILED_TRADE_BURNS_MOVE` |
| Scoring: absolute or relative? | **show both** | `engine/scoring.ts` |
| Leaderboard integrity | seed + deterministic replay (Fase 2) | run `seed` is stored |

All numeric constants are starting points to retune on real data — they live in one file (`config/gameConstants.ts`).

## Data & attribution

Game data in `data/seasons/*.json` is derived from the **"NBA, ABA, BAA Stats"** Kaggle dataset by **sumitrodatta** ([github](https://github.com/sumitrodatta/nba-aba-baa-stats)), sourced from **Basketball-Reference**, licensed **CC BY-SA 4.0**. Used here with attribution (and share-alike: the derived data stays open). We deliberately do **not** scrape Basketball-Reference directly — their terms forbid it for public tools.

To regenerate from source:
1. Download the dataset CSVs into `/archive` (e.g. `kaggle datasets download -d sumitrodatta/nba-aba-baa-stats`).
2. `npx tsx scripts/pipeline/importRealData.ts` → writes `data/seasons/*.json`.

The importer handles the real-data edge cases: traded players (`2TM`/`3TM` combined rows), combined-position labels (`PG-SG`), COVID-shortened schedules (2020/2021 normalized to an 82-game equivalent), and small-sample BPM noise (regressed toward 0 by games played, so a 1-game player can't be valued like a star). The synthetic generator (`generateFakeData.ts`) is kept for reference/offline use.
