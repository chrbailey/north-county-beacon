// api/sleeper.js — Sleeper API wrapper with IndexedDB caching

const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const NFL_SEASON = '2025';
const DB_NAME = 'sleeper-scores';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

// ── IndexedDB helpers ──

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCached(key, ttlMs) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && (Date.now() - entry.timestamp) < ttlMs) resolve(entry.data);
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function setCache(key, data) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ data, timestamp: Date.now() }, key);
  } catch { /* cache write failure is non-fatal */ }
}

// ── In-memory cache for stats (session-scoped) ──

const memCache = new Map();

function memGet(key, ttlMs) {
  const entry = memCache.get(key);
  if (entry && (Date.now() - entry.ts) < ttlMs) return entry.data;
  return null;
}

function memSet(key, data) {
  memCache.set(key, { data, ts: Date.now() });
}

// ── API fetch helper ──

async function sleeperGet(path) {
  const res = await fetch(`${SLEEPER_BASE}${path}`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Sleeper API ${res.status}: ${path}`);
  return res.json();
}

// ── Public API ──

const HOUR = 3600000;
const DAY = 86400000;

export async function getPlayers() {
  // Check IndexedDB first (24hr TTL)
  const cached = await getCached('players', DAY);
  if (cached) return cached;

  const data = await sleeperGet('/players/nfl');
  await setCache('players', data);
  return data;
}

export async function getSeasonStats(week) {
  const key = `stats_${NFL_SEASON}_${week}`;
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet(`/stats/nfl/regular/${NFL_SEASON}/${week}`);
    memSet(key, data || {});
    return data || {};
  } catch { return {}; }
}

export async function getProjections(week) {
  const key = `proj_${NFL_SEASON}_${week}`;
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet(`/projections/nfl/regular/${NFL_SEASON}/${week}`);
    memSet(key, data || {});
    return data || {};
  } catch { return {}; }
}

export async function getWeeklyStats(week) {
  const key = `weekly_${NFL_SEASON}_${week}`;
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet(`/stats/nfl/regular/${NFL_SEASON}/${week}`);
    memSet(key, data || {});
    return data || {};
  } catch { return {}; }
}

export async function getNFLState() {
  const key = 'nfl_state';
  const cached = memGet(key, HOUR);
  if (cached) return cached;

  try {
    const data = await sleeperGet('/state/nfl');
    memSet(key, data);
    return data;
  } catch { return { week: 1, season: NFL_SEASON }; }
}

export async function getUser(username) {
  return sleeperGet(`/user/${username}`);
}

export async function getUserLeagues(userId) {
  return sleeperGet(`/user/${userId}/leagues/nfl/${NFL_SEASON}`);
}

export async function getLeague(leagueId) {
  return sleeperGet(`/league/${leagueId}`);
}

export async function getRosters(leagueId) {
  return sleeperGet(`/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId) {
  return sleeperGet(`/league/${leagueId}/users`);
}

export async function fetchMultiWeekStats(playerId, currentWeek) {
  const fetchWeeks = Math.min(currentWeek, 8);
  const promises = [];
  for (let w = Math.max(1, currentWeek - fetchWeeks + 1); w <= currentWeek; w++) {
    promises.push(
      getWeeklyStats(w).then(data => ({ week: w, stats: data[playerId] || null }))
    );
  }
  const results = await Promise.allSettled(promises);
  const weeks = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value)
    .sort((a, b) => a.week - b.week);
  return weeks;
}

export { NFL_SEASON };
