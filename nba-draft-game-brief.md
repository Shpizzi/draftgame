# NBA Roster Draft Game — Project Brief per Claude Code

> Documento di handoff. Contiene design del gioco, meccaniche con formule, architettura, modello dati e ordine di costruzione. Il linguaggio di sviluppo è inglese (identificatori, tipi, file). Le note di design sono in italiano.

---

## 1. Cos'è

Un minigioco web single-player (con leaderboard community in fase 2) ispirato a **SixRings** di databallr, ma con un loop diverso: invece di draftare a board ciechi, il giocatore **pesca un roster casuale di una stagione storica NBA, lo ottimizza con pochi scambi vincolati dal valore di mercato, e poi simula la stagione** per ottenere un punteggio.

Il cuore del divertimento sono quattro cose, in quest'ordine di importanza:

1. **Decisione sotto incertezza** — la pescata iniziale è casuale, giochi la mano che ti è capitata.
2. **Gestione di risorse scarse** — solo 3 mosse di scambio, vincolate dal trade value.
3. **Completare un set con tensione** — roster da 12, ne giochi 6, il resto è profondità che conta.
4. **Flex di conoscenza** — "questo me lo ricordo io e tu no", il gancio nerd-statistico.

### Principio di design non negoziabile

> **Tutta la casualità sta PRIMA delle scelte del giocatore (la pescata) o è dato storico VISIBILE (gli infortuni reali di quella stagione). Il risultato finale deve essere sempre SPIEGABILE dalle scelte fatte.**

La simulazione ha varianza (caos narrativo voluto), ma è **varianza limitata e con input visibili**. Mai una scatola nera che sputa un numero opaco. Ogni vittoria o sconfitta deve poter essere ricondotta a: qualità del roster + disponibilità reale dei giocatori + profondità della panchina + un rumore controllato. Se il giocatore non capisce *perché* ha vinto o perso, il gioco è rotto.

---

## 2. Game loop (MVP)

```
1. SPIN          → ruota seleziona un anno casuale dal range disponibile (MVP: 2020–2026)
2. DEAL          → genera roster casuale di 12 giocatori da quell'anno (weighted: ~80% normali, superstar rare)
3. TRADE x3      → 3 mosse di scambio, pescando dall'intero pool di giocatori di quell'anno, vincolate dal trade value
4. SET ROTATION  → il giocatore sceglie quanti giocatori mandare in campo (rotazione 5–10); incide su fatica e infortuni
5. SIMULATE      → simula la stagione (no game-by-game) → record W-L, net rating, breakdown
6. REVEAL        → risultato + Injury Report + Trade History + confronto col roster originale di quell'anno
7. (fase 2) SUBMIT → invio punteggio alla leaderboard online
```

---

## 3. Meccaniche in dettaglio

> Tutte le costanti numeriche qui sotto sono **valori di partenza da tarare** (`// TUNE`). Vanno messe in un file di config centralizzato (`config/gameConstants.ts`) così sono modificabili senza toccare la logica.

### 3.1 Wheel / selezione anno

- Range MVP: `2020–2026` (7 stagioni).
- Selezione uniforme casuale all'interno del range sbloccato.
- Architettura a **ere sbloccabili**: il range è una lista di "era pack" (`{ id, label, startYear, endYear, unlocked }`). MVP ne ha uno solo. Aggiungerne altri (es. `2014–2018`, `2008–2012`) deve essere solo questione di aggiungere dati + un entry di config, **zero modifiche alla logica di gioco**.

### 3.2 Generazione roster (DEAL)

Pesca 12 giocatori dal pool della stagione selezionata, con **sampling pesato per rarità**:

- Classifica i giocatori della stagione in tier per percentile di qualità (`quality`, vedi 3.4):
  - `superstar` (top ~1%) — peso di sampling bassissimo
  - `star` (next ~9%)
  - `starter` (next ~30%)
  - `role` (resto)
- Obiettivo distribuzione attesa di un roster da 12: ~80% role/starter, comparsa di una superstar con probabilità molto bassa (~0.5% per slot → raro ma esiste).
- Vincolo di costruibilità: il roster deve poter schierare un lineup valido. Garantire **almeno 1 giocatore idoneo per ruolo** tra PG/SG/SF/PF/C (forzare il pescaggio dei ruoli mancanti se il sampling casuale non li copre).

```ts
// pesi di sampling per tier — TUNE
const TIER_WEIGHTS = { superstar: 0.5, star: 8, starter: 30, role: 61.5 };
```

### 3.3 Scambi (TRADE)

Il giocatore ha **3 mosse**. Una mossa = uno scambio. Lo scambio è **a vista**: scegli chi mandare via dal tuo roster e quale giocatore target prendere dall'intero pool della stagione.

**Scambio asimmetrico (2-per-1):** poiché il roster è sempre pieno a 12, per prendere un giocatore di valore alto puoi offrire **due** giocatori. Scende a 11 → il sistema ti fa ripescare un role player di riempimento, OPPURE puoi scegliere di giocare con rosa corta (vedi 3.6).

**Trade value:** ogni giocatore ha un valore `tradeValue` calcolato **per quella specifica stagione** (fedele alla realtà: lo stesso giocatore vale diversamente in anni diversi). Vedi 3.4 per la derivazione.

**Probabilità di accettazione dello scambio** — questo è il meccanismo chiave:

```
offer  = somma dei tradeValue dei giocatori che offri
target = tradeValue del giocatore che vuoi
gap    = target - offer

if gap <= 0:   acceptance = 0.99      // offri valore pari o superiore → quasi certo
else:          acceptance = curva decrescente sul gap
```

Punti di ancoraggio richiesti (da rispettare in fase di tuning):
- `offer 45, target 50` (gap 5) → **~10%**
- `offer ≥ target` → **~99%**

Funzione suggerita (tunable):
```ts
// acceptance per gap > 0 — TUNE costanti REF e EXP
const REF = 5;   // gap di riferimento
const EXP = 1;
acceptance = clamp(0.10 * Math.pow(REF / (gap), EXP), 0.01, 0.95);
// con gap=5 → 0.10; gap minori → sale; gap maggiori → scende
```

Effetto voluto: vendere un "7" per puntare a un "8" o "9" è possibile ma con probabilità piccola e decrescente. Questo è l'upside-variance che dà brivido senza rompere l'economia.

**Importante UX:** mostra la probabilità di accettazione PRIMA di confermare lo scambio (fortuna in chiaro). Se lo scambio fallisce il tiro, **la mossa è comunque consumata** (altrimenti il vincolo non morde). Da decidere in tuning se uno scambio fallito brucia la mossa o solo il tentativo — default consigliato: **brucia la mossa** (tiene alta la tensione).

### 3.4 Quality e Trade Value (il punto critico)

Nessuna fonte fornisce `tradeValue` pronto. **Va derivato** da una metrica esistente. Questa è la parte che determina la credibilità dell'intero gioco.

- `quality` del giocatore-stagione = composito derivato da una metrica avanzata robusta. Per le ere recenti (2020–2026) usare **BPM** o **VORP** (disponibili nei dataset, vedi sezione dati), eventualmente combinati con minuti/partite per pesare l'impatto reale.
- `tradeValue` = normalizzazione di `quality` su una scala leggibile (es. 1–100) **all'interno della stessa stagione/era**. NON normalizzare in assoluto tra ere diverse (un "7" del 2024 non è un "7" del 2004).

```ts
// punto di partenza — TUNE pesi e scala
quality = w1 * BPM + w2 * (VORP) + w3 * availabilityFactor;
tradeValue = scaleToRange(quality, season, 1, 100);
```

> Flag esplicito per lo sviluppo: isolare `quality` e `tradeValue` dietro un'interfaccia (`PlayerValuation`) così la formula è sostituibile senza toccare il resto. È quasi certo che andrà ritarata più volte.

### 3.5 Infortuni — IMPLICITI, non espliciti

Non esiste un flag "infortunato sì/no". Gli infortuni sono **già dentro le stat reali di quella stagione**: un giocatore che ha giocato 30 partite su 82 ha numeri stagionali bassi e `gamesPlayed` basso. Il dato storico fa il lavoro.

- `availability_i = gamesPlayed_i / 82` (clamp a 1.0)
- Un fuoriclasse fragile contribuisce tanto ma solo per le partite che ha davvero giocato.
- L'**Injury Report** (feature, sez. 4) si limita a *mostrare* questo dato prima della sim: è informazione, non un dado nascosto.

### 3.6 Rotazione e profondità panchina

Roster = 12. Il giocatore sceglie la **dimensione della rotazione** (quanti giocatori giocano davvero, range 5–10).

- **Rotazione corta** (5–6 giocatori forti): contributo individuale alto MA `fatigueFactor` penalizzante e maggior rischio di cascata infortuni nella sim. Basta un ko e crolli.
- **Rotazione larga** (8–10): carico distribuito, `fatigueFactor` migliore, più consistenza, ma diluisci la qualità.

Questo è il dilemma narrativo centrale del gioco. Modellarlo bene è più importante della grafica.

```ts
// fatica in funzione della dimensione rotazione e profondità qualità — TUNE
fatigueFactor = clamp(1 - k_fatigue * (IDEAL_ROTATION - rotationSize) / IDEAL_ROTATION, floor, 1.0);
// IDEAL_ROTATION ~ 8; rotazioni più corte → fatigueFactor < 1
benchDepthBonus = f(quality media dei giocatori fuori rotazione);
```

### 3.6 Simulazione stagione (SIMULATE)

**No game-by-game.** Si calcola una forza stagionale e la si converte in record, aggiungendo eventi di infortunio probabilistici e rumore limitato.

```
1. Per ogni giocatore in rotazione:
     effectiveContribution_i = quality_i * availability_i
2. rosterStrength = (somma contributi starters, pesata per minuti)
                    * fatigueFactor
                    + benchDepthBonus
3. EVENTI INFORTUNIO durante la sim (varianza voluta, ma limitata):
     - per ogni giocatore, rischio extra-infortunio scala INVERSAMENTE con la profondità
       (rotazione corta → più rischio)
     - un evento riduce ulteriormente availability_i di quel giocatore
     - LIMITARE numero/impatto massimo eventi (no wipeout improbabili)
4. expectedWins = logisticMap(rosterStrength)   // mappa 0..82
5. finalWins = clamp(expectedWins + gaussianNoise(0, sigma), 0, 82)   // sigma piccolo, TUNE
6. netRating, ORtg, DRtg derivati da rosterStrength + split offense/defense del roster
```

Output della sim (oggetto `SimResult`):
- `wins`, `losses`
- `netRating`, `oRtg`, `dRtg`
- `breakdown[]` — contributo di ogni giocatore (questo alimenta la spiegabilità: l'utente vede i numeri che hanno prodotto il risultato)
- `injuryEvents[]` — cosa è successo nella sim
- `seed` — per riproducibilità (vedi sez. 6 leaderboard integrity)

### 3.7 Scoring

Il punteggio per la leaderboard può essere:
- **Assoluto**: `wins` (o net rating). Semplice. Premia anche chi ha pescato bene.
- **Relativo** (consigliato per equità): performance vs il **roster originale reale** di quella stagione → "hai fatto X vittorie, la squadra reale ne fece Y". Premia l'ottimizzazione, non solo la fortuna della ruota. Questo è anche la feature "Comparative Bench" (sez. 4).

Decisione di prodotto da prendere in fase 2. MVP: mostra entrambi.

---

## 4. Feature aggiuntive (tutte a basso costo dati)

Le tre si incastrano e usano dati già presenti, zero fonti nuove:

1. **Injury Report (pre-sim)** — prima di simulare, pannello con i giocatori del roster e le partite saltate quell'anno. Non obbligatorio leggerlo, ma rivela il rischio del roster costruito. È informazione visibile, coerente col principio "fortuna in chiaro".

2. **Trade History Tracker** — registra ogni scambio. A fine sim mostra "hai venduto X, preso Y; questo trade è valso ~Z vittorie". Puro feedback didattico, è solo visualizzazione del breakdown.

3. **Comparative Bench (post-sim)** — confronta il tuo risultato col roster originale reale di quell'anno ("tu 60 W, i Lakers reali 58 W"). È il feedback più forte e trasforma la leaderboard in "chi ha ottimizzato meglio la pescata".

---

## 5. Architettura

### Principio: motore agnostico + dati come plugin

Il loop (wheel, deal, trade, rotation, sim, scoring) deve essere **indipendente dal dataset**. I dati (stagioni, giocatori, valori) entrano come JSON. Cambiare/aggiungere ere = aggiungere dati, non toccare la logica. Questo permette anche, in futuro, di riusare lo stesso motore per altri domini.

### Stack MVP (fase 1 — single player, zero backend)

- **Next.js + TypeScript** (App Router)
- Dati di gioco in **JSON statico** versionato nel repo (`/data/seasons/*.json`). Dataset minuscolo (~3.000–3.500 record totali per 2020–2026, pochi MB).
- **Simulazione e logica interamente client-side** in TypeScript.
- Deploy: **Cloudflare Pages o Vercel**, sito statico. Nessun server, nessun costo, niente da mantenere.

### Stack fase 2 (community — solo quando il loop diverte)

- **Supabase** (Postgres gestito + auth): tabelle per `users`, `runs`, `leaderboard`.
- Leaderboard online, profili pubblici, visualizzazione run altrui (anche solo in lettura, senza sfida).

> **Sequenza obbligatoria:** prima il single player client-side, provato e divertente, POI il backend. Non costruire infrastruttura community prima di sapere che il gioco regge.

### Leaderboard integrity (decisione aperta, sez. 9)

Se la sim gira nel browser, un utente può manipolare il risultato prima di inviarlo. Per gioco tra amici irrilevante; per leaderboard pubblica seria serve **sim lato server** o validazione server-side via `seed` + replay deterministico. Da decidere prima della fase 2.

---

## 6. Modello dati (TypeScript)

```ts
// --- Dati statici (dal dataset) ---
type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
type Tier = 'superstar' | 'star' | 'starter' | 'role';

interface PlayerSeason {
  id: string;            // univoco per giocatore-stagione
  name: string;
  team: string;
  season: number;        // es. 2024
  position: Position;
  // stat base
  ppg: number; rpg: number; apg: number;
  gamesPlayed: number;   // reale → infortuni impliciti
  // metriche derivate
  bpm: number; vorp: number;
  quality: number;       // composito calcolato in pipeline
  tradeValue: number;    // 1–100, normalizzato per stagione
  tier: Tier;
}

interface SeasonData {
  season: number;
  players: PlayerSeason[];
  originalRosters: Record<string, {        // per Comparative Bench
    team: string;
    playerIds: string[];
    actualWins: number;
  }>;
}

// --- Stato di gioco (runtime) ---
interface GameState {
  season: number;
  roster: PlayerSeason[];        // 12
  rotation: string[];            // ids in rotazione (5–10)
  movesLeft: number;             // parte da 3
  tradeHistory: TradeRecord[];
  phase: 'spin' | 'deal' | 'trade' | 'rotation' | 'sim' | 'reveal';
}

interface TradeRecord {
  out: string[];                 // ids ceduti
  in: string;                    // id preso
  offerValue: number;
  targetValue: number;
  acceptanceProb: number;
  succeeded: boolean;
}

interface SimResult {
  wins: number; losses: number;
  netRating: number; oRtg: number; dRtg: number;
  breakdown: { playerId: string; contribution: number }[];
  injuryEvents: { playerId: string; gamesLost: number }[];
  seed: string;
}
```

---

## 7. Sourcing dati (NON scrapare Basketball-Reference per uso pubblico)

**Vincolo legale importante:** Sports-Reference (Basketball-Reference) **vieta esplicitamente di costruire siti o tool basati su dati scrapati dal loro sito** senza permesso, e parte dei loro dati è sotto licenza che ne impedisce la ridistribuzione. Per un gioco pubblico con leaderboard è esattamente la cosa che vietano. Rate limit: 20 req/min, ban fino a un giorno se sfori.

**Strada pulita:**
1. **Kaggle** — dataset NBA già aggregati e con licenza esplicita (cercare "NBA player stats", filtrare per licenza aperta). Spesso includono BPM/VORP. **Prima scelta per l'MVP.**
2. **`nba_api` (Python)** — pesca da stats.nba.com (dati ufficiali NBA). Più pulito legalmente, copre 2020–2026 con metriche avanzate. Ogni tanto blocca le richieste, gestire retry.
3. Scraping BR **solo come ultima spiaggia**, per campi che gli altri non hanno (es. certi infortuni), e solo per uso personale, mai ridistribuito.

**Pipeline dati (one-shot, i dati sono statici):**
```
sorgente (Kaggle/nba_api) → normalizzazione → calcolo quality + tradeValue → /data/seasons/{year}.json
```
Va eseguita una volta sola per le 7 stagioni. Output committato nel repo. Il gioco non tocca mai fonti esterne a runtime.

---

## 8. Struttura del progetto (suggerita)

```
/data/seasons/            # JSON statici per stagione (output pipeline)
/scripts/pipeline/        # script one-shot di sourcing + calcolo valori (Python o TS)
/src/
  /engine/                # MOTORE AGNOSTICO DAL DOMINIO
    wheel.ts
    rosterGenerator.ts
    tradeSystem.ts
    simulation.ts
    scoring.ts
    valuation.ts          # quality + tradeValue dietro interfaccia sostituibile
  /config/
    gameConstants.ts      # TUTTE le costanti tarabili qui
  /state/                 # GameState, reducer/store
  /components/            # UI: Wheel, RosterBoard, TradePanel, RotationPicker, SimReveal,
                          #     InjuryReport, TradeHistory, ComparativeBench
  /app/                   # Next.js routes
/tests/                   # test del motore (sim deterministica con seed fisso)
```

---

## 9. Decisioni ancora aperte (da risolvere durante il build)

1. **Formula `quality`/`tradeValue`** — pesi esatti BPM/VORP/disponibilità. Partire semplice, iterare sui dati reali.
2. **Scambio fallito brucia mossa o tentativo?** Default: brucia la mossa.
3. **Scoring leaderboard: assoluto o relativo al roster reale?** MVP mostra entrambi, scelta in fase 2.
4. **Leaderboard integrity: sim client o server?** Irrilevante per MVP, da decidere prima della fase 2 (seed + replay deterministico è il compromesso).
5. **Definizione "rotazione" e mapping minuti** — quanti in campo contemporaneamente vs rotazione totale.

---

## 10. Ordine di costruzione (cosa fare PRIMA)

> Regola d'oro: **prototipare il loop con dati FINTI prima di sourcing reale.** Se il loop non diverte con dati sintetici, non divertirà nemmeno con quelli veri, e si risparmiano settimane.

**Fase 0 — Loop giocabile con dati finti**
1. Generare 7 "stagioni" sintetiche di giocatori fake con `quality`/`tradeValue` plausibili.
2. Implementare engine: wheel → rosterGenerator → tradeSystem → simulation → scoring.
3. UI minimale ma funzionante per tutto il loop. Giocabile end-to-end.
4. **Test col gioco vero (tu + amico).** Tarare le costanti finché il loop è teso e divertente.

**Fase 1 — Dati reali**
5. Pipeline di sourcing (Kaggle/nba_api) per 2020–2026 → JSON.
6. Calcolo `quality`/`tradeValue` reali, sostituire i dati finti.
7. Ritarare. Aggiungere Injury Report, Trade History, Comparative Bench.
8. Polish UI/UX, poster condivisibile a fine run. Deploy statico.

**Fase 2 — Community**
9. Supabase: auth, tabella runs, leaderboard.
10. Risolvere integrity (seed/replay o sim server). Profili e visualizzazione run altrui.
11. Sistema di ere sbloccabili come progressione di gioco.

---

## Appendice — istruzioni operative per Claude Code

- Inizia dalla **Fase 0**. Non scrivere pipeline di sourcing né toccare fonti esterne finché il loop con dati finti non è giocabile e validato.
- Metti **ogni costante numerica** in `config/gameConstants.ts` con commento `// TUNE` e valore di partenza dalle formule qui sopra.
- Tieni l'**engine puro e deterministico dato un seed** (la casualità passa sempre da un RNG seedabile), così i test e la futura integrity sono possibili.
- Mantieni la **separazione netta engine ↔ dati ↔ UI**. L'engine non deve sapere nulla di NBA: riceve `PlayerSeason[]` e config, restituisce risultati.
- Scrivi **test sull'engine** con seed fisso per: generazione roster (distribuzione tier), accettazione scambi (punti di ancoraggio gap 5 → ~10%, gap ≤ 0 → ~99%), sim (range output plausibile, spiegabilità del breakdown).
