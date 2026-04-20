# sleeper-scores

Open-source fantasy football intelligence. Every number shows its math.

**Live site:** [chrbailey.github.io/sleeper-scores](https://chrbailey.github.io/sleeper-scores/)

**Status:** v0.1 experimental. Runtime is a static site (zero build, zero backend). There is a separate offline Python pipeline under `analysis/` that generates the JSON profile files shipped in `data/` — that step is run manually before a data refresh, not at page load.

---

## What It Does

Search any NFL player and get a full intelligence card: composite grade, dynasty value, weekly trend analysis, news buzz, ceiling/floor projections, and a scouting report. Drop players into the Trade Analyzer to compare dynasty values side by side.

**The differentiator:** Click any computed number to see exactly how it was calculated — the formula, the inputs, the benchmarks, and the caveats. No black boxes.

## What It Computes

| Metric | Method | Click to See |
|--------|--------|-------------|
| **Stat-Based Score (0-99)** | Percentile rank of per-game stats against position-specific benchmarks | Component breakdown, benchmark arrays, weights, weighted sum |
| **Dynasty Score (1-99)** | Production (40%) + youth (30%) + longevity (15%) + position premium (15%) - penalties | Age curve, peak window, touch cliff estimate, injury multiplier |
| **Trend** | Linear regression + coefficient of variation on 2-8 weeks of fantasy points | Slope, CV, consecutive streaks, recent vs season mean, signal thresholds |
| **News Buzz (-100 to +100)** | Keyword frequency scoring on Google News headlines | Keyword lists, match counts, articles scanned, scoring formula |
| **Ceiling / Floor** | Projected points × position variance multiplier | Multiplier per position, caveat that it's a heuristic not a CI |
| **Fantasy Points** | Standard scoring rules (PPR / Half / Standard) | Each stat × multiplier = contribution |

## What This Is NOT

- **Not a replacement for paid fantasy tools.** This is a free, transparent explainer — not a projection service. Numbers update when Sleeper's public stats update. There is no proprietary projection model.
- **Not "zero build, zero backend" end to end.** The browser runtime is static (no bundler, no server). But the player profile JSON files shipped under `data/` are produced by Python scripts in `analysis/` that read `pbp_YYYY.csv` files (not included in the repo due to size). If you fork and want to refresh profiles, you will run Python offline.
- **Not a live game-day tool.** Cache windows are 24 hours on IndexedDB. News headlines depend on rss2json.com's free tier and Google News availability.
- **Not ceiling/floor as a confidence interval.** It's a position-specific variance multiplier over a point projection. Readable and honest, but not statistically rigorous.

## Setup (60 seconds)

1. Open the site (or run `python3 -m http.server` in this directory and hit `http://localhost:8000`).
2. Click **Settings** and enter your Sleeper username.
3. Search any player in **Scout** or compare trades in **Trade**.

No accounts, no API keys, no bundler, no server. First load fetches the ~9MB player database; subsequent loads hit IndexedDB and are instant.

## How It Works

### Browser runtime (zero build, zero backend)

- **Sleeper API** (free, no auth, CORS-friendly) provides player data, per-game stats, and weekly projections.
- **Google News RSS** via `rss2json.com` provides headlines for the news buzz feature.
- **IndexedDB** caches the 9MB player database for 24 hours — second visit loads instantly.
- **localStorage** persists your configuration (username, leagues, scoring format).

### Offline data pipeline (Python)

Under `analysis/` there are scripts that load nflfastR play-by-play CSVs and produce per-position profile JSON files:

- `loader.py` — load and type-convert `pbp_YYYY.csv`.
- `qb_profile.py`, `rb_profile.py`, `receiver_profile.py`, `coordinator_profile.py` — per-position aggregations.
- `analytics.js` under `engine/` consumes the generated JSON at runtime.

These are only needed if you want to refresh or regenerate the profiles shipped in `data/`. End users never run them.

## File Structure

```
sleeper-scores/
├── index.html              # Shell: loads ES modules, mounts React app
├── style.css               # Design tokens (CSS custom properties) + component styles
├── config.js               # localStorage persistence for user settings
├── engine/                 # Pure computation — zero DOM, zero React, zero side effects
│   ├── scoring.js          # Fantasy point calculation (PPR/half/standard)
│   ├── grades.js           # Composite grading: benchmarks, percentile scoring, weights
│   ├── dynasty.js          # Dynasty valuation: age curves, touch cliff, position premium
│   ├── trends.js           # Multi-week pattern analysis: regression, CV, buy/sell signals
│   ├── sentiment.js        # News keyword buzz scoring (honestly labeled)
│   └── analytics.js        # Consumes profile JSON produced by analysis/
├── api/                    # Data fetching — zero engine or UI dependencies
│   ├── sleeper.js          # Sleeper API wrapper + IndexedDB cache
│   ├── news.js             # Google News RSS fetch via rss2json.com
│   └── profiles.js         # Load pre-generated profile JSON from data/
├── data/                   # Shipped profile JSON (qb/rb/receiver/team) — generated offline
├── analysis/               # Python pipeline — reads pbp CSVs, writes data/*.json (manual)
├── tests/
│   └── engine.test.mjs     # 46 engine tests (node tests/engine.test.mjs)
└── ui/                     # React components (ES modules + htm)
    ├── htm.js              # htm + React binding (shared by all UI modules)
    ├── app.js              # Root: data loading, routing, state management
    ├── scout.js            # Player search + results table
    ├── trade.js            # Trade analyzer with explainable verdict
    ├── card.js             # Player Intelligence Card (the core UI unit)
    ├── explain.js          # ExplainPanel — the "show your work" interaction
    ├── settings.js         # Configuration panel
    └── primitives.js       # GradeRing, Sparkline, SentimentMeter, badges
```

**Architecture rule:** `engine/` has zero imports from `api/` or `ui/`. `api/` has zero imports from `ui/`. Arrows only point downward. The engine is portable — import it into Node, a test harness, or a different UI.

## Tests

46 engine tests run under plain Node, no framework:

```bash
node tests/engine.test.mjs
```

Output ends with `Results: 46 passed, 0 failed`. CI runs this on Node 20 and 22 for every push and PR.

## Forking This

**Change the design:** Edit CSS custom properties in `style.css` (lines 4-22).

**Change the grades:** Edit `BENCHMARKS` and `WEIGHTS` in `engine/grades.js`. These are exported constants at the top of the file.

**Change dynasty valuation:** Edit `AGE_CURVES` and `DYNASTY_WEIGHTS` in `engine/dynasty.js`.

**Change trend thresholds:** Edit `TREND_THRESHOLDS` in `engine/trends.js`.

**Change sentiment keywords:** Edit `POSITIVE_KEYWORDS` and `NEGATIVE_KEYWORDS` in `engine/sentiment.js`.

**Change scoring rules:** Edit `SCORING_RULES` in `engine/scoring.js`.

Every constant that drives a computation is exported, named, and at the top of its file.

## Tech Stack

- React 18 (via esm.sh CDN)
- [htm](https://github.com/developit/htm) — JSX alternative, 700 bytes, no build step
- ES modules via import maps — no bundler
- Sleeper API (free, no auth)
- Google News RSS via rss2json.com
- IndexedDB for player database caching
- CSS custom properties for theming
- GitHub Pages hosting

## Data Sources

| Data | Source |
|------|--------|
| Player database | Sleeper API `/players/nfl` |
| Per-game stats | Sleeper API `/stats/nfl/regular/{season}/{week}` |
| Projections | Sleeper API `/projections/nfl/regular/{season}/{week}` |
| Age curves | EPA 2014-2024 positional study |
| RB touch cliff | Historical research (2,500 career touches) |
| News headlines | Google News RSS via rss2json.com |

## Known Limitations

- **News buzz uses keyword frequency, not sentiment analysis.** The README page for `engine/sentiment.js` is honest about this: you are counting `POSITIVE_KEYWORDS` and `NEGATIVE_KEYWORDS` matches. Sarcasm and context are lost.
- **Trend analysis needs 2+ weeks.** Early in the season or for players with thin game logs, the trend card flips to "insufficient data".
- **Sleeper's stats feed is authoritative.** If it is stale or delayed, so is the site. No backup feed.
- **Profile JSON is manually refreshed.** Shipped profiles cover 2024-2025 (98,263 plays). Older seasons require re-running the Python pipeline.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md). Changes: [CHANGELOG.md](CHANGELOG.md).

## License

MIT

---

Built with Claude.
