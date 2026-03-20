// engine/dynasty.js — Dynasty valuation with age curves and explainable results

export const AGE_CURVES = {
  QB: { peakStart: 28, peakEnd: 33, declineStart: 34, cliff: 40, avgCareer: 15, primeLabel: '28-33' },
  RB: { peakStart: 23, peakEnd: 26, declineStart: 27, cliff: 30, avgCareer: 6, primeLabel: '23-26', touchCliff: 2500, heavySeason: 370 },
  WR: { peakStart: 25, peakEnd: 30, declineStart: 31, cliff: 33, avgCareer: 10, primeLabel: '25-30' },
  TE: { peakStart: 26, peakEnd: 30, declineStart: 31, cliff: 34, avgCareer: 9, primeLabel: '26-30' },
  K:  { peakStart: 26, peakEnd: 36, declineStart: 37, cliff: 42, avgCareer: 12, primeLabel: '26-36' },
  DEF:{ peakStart: 25, peakEnd: 30, declineStart: 31, cliff: 34, avgCareer: 7, primeLabel: '25-30' },
};

export const DYNASTY_WEIGHTS = {
  production: 2.0,
  youthPerYear: 3.0,
  longevityPerYear: 1.0,
  positionPremium: { QB: 12, WR: 4, TE: 2, RB: 0, K: 0, DEF: 0 },
};

export function getTrajectory(age, position) {
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  if (age < curve.peakStart) {
    return { label: 'ASCENDING', color: '#16a34a', yearsToCliff: curve.cliff - age, yearsToPeak: curve.peakStart - age, phase: 0.25 };
  }
  if (age <= curve.peakEnd) {
    return { label: 'PRIME', color: '#2563eb', yearsToCliff: curve.cliff - age, yearsToPeak: 0, phase: 0.5 };
  }
  if (age <= curve.declineStart + 1) {
    return { label: 'DECLINING', color: '#f59e0b', yearsToCliff: curve.cliff - age, yearsToPeak: 0, phase: 0.75 };
  }
  return { label: 'LATE CAREER', color: '#dc2626', yearsToCliff: Math.max(0, curve.cliff - age), yearsToPeak: 0, phase: 0.95 };
}

export function estimateCareerTouches(yearsExp, avgPerSeason = 200) {
  const touches = (yearsExp || 0) * avgPerSeason;
  return {
    value: touches,
    explain: {
      method: 'Career touches estimated from years of experience',
      inputs: { yearsExp, avgPerSeason },
      formula: `${yearsExp} years x ${avgPerSeason} avg touches/season = ${touches}`,
      source: 'Sleeper years_exp field',
      caveats: [
        'Estimated from years of experience x 200 avg touches/season',
        'Actual career touch data not available from Sleeper API',
        'Does not account for injury seasons or backup years',
      ],
    },
  };
}

export function calcDynastyValue(projected, position, age, yearsExp, injuryStatus) {
  const curve = AGE_CURVES[position] || AGE_CURVES.WR;
  const traj = getTrajectory(age, position);
  const yearsLeft = Math.max(0, curve.cliff - age);
  const peakYrsLeft = Math.max(0, curve.peakEnd - age);
  const posPremium = DYNASTY_WEIGHTS.positionPremium[position] || 0;

  const productionScore = projected * DYNASTY_WEIGHTS.production;
  const youthScore = peakYrsLeft * DYNASTY_WEIGHTS.youthPerYear;
  const longevityScore = yearsLeft * DYNASTY_WEIGHTS.longevityPerYear;

  let raw = productionScore + youthScore + longevityScore + posPremium;
  const penalties = [];

  // RB workload penalties
  if (position === 'RB') {
    const estTouches = estimateCareerTouches(yearsExp);
    if (estTouches.value > 2500) { raw *= 0.65; penalties.push(`Past touch cliff (~${estTouches.value} est. touches > 2500): x0.65`); }
    else if (estTouches.value > 2000) { raw *= 0.80; penalties.push(`Approaching touch cliff (~${estTouches.value} est. touches): x0.80`); }
    else if (estTouches.value > 1500) { raw *= 0.90; penalties.push(`Wear showing (~${estTouches.value} est. touches): x0.90`); }
    if (age >= 28) { raw *= 0.70; penalties.push(`Age ${age} >= 28 (RB steep decline): x0.70`); }
    else if (age >= 27) { raw *= 0.85; penalties.push(`Age ${age} >= 27 (RB decline zone): x0.85`); }
  }

  // Injury penalty
  if (injuryStatus) {
    if (injuryStatus === 'Out' || injuryStatus === 'IR') { raw *= 0.50; penalties.push(`Injury: ${injuryStatus}: x0.50`); }
    else if (injuryStatus === 'Doubtful') { raw *= 0.70; penalties.push(`Injury: Doubtful: x0.70`); }
    else if (injuryStatus === 'Questionable') { raw *= 0.90; penalties.push(`Injury: Questionable: x0.90`); }
  }

  const value = Math.min(99, Math.max(1, Math.round(raw)));

  const formulaParts = [
    `production: ${projected.toFixed(1)} x ${DYNASTY_WEIGHTS.production} = ${productionScore.toFixed(1)}`,
    `youth: ${peakYrsLeft}yr x ${DYNASTY_WEIGHTS.youthPerYear} = ${youthScore.toFixed(1)}`,
    `longevity: ${yearsLeft}yr x ${DYNASTY_WEIGHTS.longevityPerYear} = ${longevityScore.toFixed(1)}`,
    `position: +${posPremium}`,
  ];

  return {
    value,
    trajectory: traj,
    explain: {
      method: 'Composite dynasty score: production + youth + longevity + position premium - penalties',
      inputs: { projected, position, age, yearsExp, injuryStatus, peakYrsLeft, yearsLeft },
      formula: formulaParts.join(' + ') + ` = ${Math.round(productionScore + youthScore + longevityScore + posPremium)}` + (penalties.length ? ` then penalties: ${penalties.join(', ')} = ${value}` : ` = ${value}`),
      weights: DYNASTY_WEIGHTS,
      benchmarks: curve,
      source: 'Sleeper projections + player metadata',
      caveats: [
        'Age curves based on EPA 2014-2024 positional study — individual players may deviate',
        'Injury multiplier uses current injury status, not injury history',
        ...(position === 'RB' ? ['Career touches estimated, not actual — see touch estimate caveat'] : []),
      ],
    },
  };
}
