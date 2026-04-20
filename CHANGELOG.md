# Changelog

All notable changes to sleeper-scores are documented here.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- `tests/engine.test.mjs` previously renamed from `engine.test.js` but the new
  file was committed empty. CI silently passed with zero assertions. The file
  now contains all 46 engine tests and the duplicate `.js` has been removed.

### Changed
- README now calls out the split between the static browser runtime (zero
  build, zero backend) and the offline Python pipeline under `analysis/` that
  generates the shipped profile JSON. Added "What this is NOT" and "Known
  Limitations" sections.
- Added this CHANGELOG.

## [2025.1] — 2026-03-22

### Added
- 2025 season data: profiles now cover 2024+2025 (98,263 plays).
- Interactive data report: "7 patterns the industry gets wrong".
- JSON profile data shipped with the site for GitHub Pages.

### Fixed
- Updated references from "2024" to "2024-2025".

## [0.1.0] — earlier 2026

### Added
- Static React 18 site via esm.sh + htm (no bundler).
- Player Intelligence Card with composite grade, dynasty score, trend, news
  buzz, ceiling/floor, fantasy points.
- Trade Analyzer.
- "Show your work" `ExplainPanel` interaction — every computed number exposes
  its formula, inputs, benchmarks, and caveats.
- Engine layer with zero DOM / React / side-effect dependencies:
  `scoring`, `grades`, `dynasty`, `trends`, `sentiment`, `analytics`.
- IndexedDB cache (24 h) for the ~9 MB player database.
- localStorage persistence for user settings.
- Sleeper API integration (no auth).
- Google News RSS via rss2json.com for news buzz.
- Python analysis pipeline under `analysis/` for per-position profile
  generation from nflfastR play-by-play.
- 46 engine tests runnable via plain Node (`node tests/engine.test.mjs`).
- GitHub Pages hosting.
