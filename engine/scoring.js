// engine/scoring.js — Fantasy point calculation with explainable results

export const SCORING_RULES = {
  ppr:      { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 1,   fum_lost: -2, fgm: 3, xpm: 1 },
  half_ppr: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0.5, fum_lost: -2, fgm: 3, xpm: 1 },
  standard: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 0,   fum_lost: -2, fgm: 3, xpm: 1 },
};

export const VARIANCE_MULTIPLIERS = {
  ceiling: { QB: 1.5, RB: 1.6, WR: 1.7, TE: 1.8, K: 1.3 },
  floor:   { QB: 0.5, RB: 0.3, WR: 0.3, TE: 0.2, K: 0.5 },
};

export function calcFantasyPts(stats, format = 'ppr') {
  if (!stats) return { value: 0, explain: { method: 'No stats available', inputs: {}, formula: '0', source: 'N/A', caveats: [] } };

  const rules = SCORING_RULES[format] || SCORING_RULES.ppr;
  const contributions = {};
  let total = 0;

  for (const [stat, multiplier] of Object.entries(rules)) {
    const raw = stats[stat] || 0;
    if (raw === 0 && multiplier >= 0) continue;
    const pts = raw * multiplier;
    contributions[stat] = { raw, multiplier, pts: Math.round(pts * 100) / 100 };
    total += pts;
  }

  const value = Math.round(total * 10) / 10;
  const formulaParts = Object.entries(contributions)
    .filter(([, c]) => c.pts !== 0)
    .map(([stat, c]) => `${c.raw} ${stat} x ${c.multiplier} = ${c.pts.toFixed(1)}`);

  return {
    value,
    explain: {
      method: `${format.toUpperCase()} fantasy point calculation`,
      inputs: contributions,
      formula: formulaParts.join(' + ') + ` = ${value}`,
      source: 'Sleeper API stats',
      caveats: format === 'ppr'
        ? ['Full PPR: each reception = 1 point']
        : format === 'half_ppr'
          ? ['Half PPR: each reception = 0.5 points']
          : ['Standard: receptions have no point value'],
    },
  };
}

export function calcCeilingFloor(projectedPts, position = 'WR') {
  const ceilMult = VARIANCE_MULTIPLIERS.ceiling[position] || 1.7;
  const floorMult = VARIANCE_MULTIPLIERS.floor[position] || 0.3;
  const ceiling = Math.round(projectedPts * ceilMult * 10) / 10;
  const floor = Math.round(projectedPts * floorMult * 10) / 10;

  return {
    ceiling: {
      value: ceiling,
      explain: {
        method: `Ceiling = projected pts x position variance multiplier`,
        inputs: { projected: projectedPts, multiplier: ceilMult, position },
        formula: `${projectedPts} x ${ceilMult} = ${ceiling}`,
        source: 'Sleeper projections x position-specific variance heuristic',
        caveats: ['Heuristic range, not a statistical confidence interval', `${position} ceiling multiplier: ${ceilMult}`],
      },
    },
    floor: {
      value: floor,
      explain: {
        method: `Floor = projected pts x position variance multiplier`,
        inputs: { projected: projectedPts, multiplier: floorMult, position },
        formula: `${projectedPts} x ${floorMult} = ${floor}`,
        source: 'Sleeper projections x position-specific variance heuristic',
        caveats: ['Heuristic range, not a statistical confidence interval', `${position} floor multiplier: ${floorMult}`],
      },
    },
  };
}
