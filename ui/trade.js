// ui/trade.js — Trade Analyzer with explainable verdicts

import { React, html } from './htm.js';
import { PlayerIntelligenceCard } from './card.js';
import { computeCompositeGrade, gradeColor } from '../engine/grades.js';
import { calcDynastyValue } from '../engine/dynasty.js';
import { calcFantasyPts } from '../engine/scoring.js';
import { ExplainPanel } from './explain.js';
import { GradeRing, POS_COLORS, NFL_TEAMS } from './primitives.js';

const { useState, useEffect, useMemo } = React;

export function TradeAnalyzer({ players, stats, projections, currentWeek, scoringFormat }) {
  const [sideA, setSideA] = useState([]);
  const [sideB, setSideB] = useState([]);
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const format = scoringFormat || 'ppr';

  const searchPlayers = (query) => {
    if (!query || query.length < 2 || !players) return [];
    const q = query.toLowerCase();
    return Object.entries(players)
      .filter(([id, p]) => (p.status === 'Active' || p.active === true || (p.team && p.team !== '')) &&
        p.position && ['QB','RB','WR','TE','K'].includes(p.position) &&
        (`${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().includes(q) || (NFL_TEAMS[p.team] || '').includes(q))
      .slice(0, 8)
      .map(([id, p]) => ({ id, ...p }));
  };

  const resultsA = useMemo(() => searchPlayers(searchA), [searchA, players]);
  const resultsB = useMemo(() => searchPlayers(searchB), [searchB, players]);

  const getPlayerValue = (p) => {
    const proj = projections[p.id] || {};
    const projected = calcFantasyPts(proj, format).value;
    const grade = computeCompositeGrade(stats[p.id] || {}, p.position);
    const dynasty = calcDynastyValue(projected, p.position, p.age || 0, p.years_exp || 0, p.injury_status);
    return { projected, grade, dynasty };
  };

  const totalVal = (side) => side.reduce((s, p) => s + getPlayerValue(p).dynasty.value, 0);
  const totalProj = (side) => side.reduce((s, p) => s + getPlayerValue(p).projected, 0);

  const addPlayer = (side, player) => {
    if (side === 'A') { setSideA(s => [...s, player]); setSearchA(''); }
    else { setSideB(s => [...s, player]); setSearchB(''); }
  };

  const valDiff = totalVal(sideB) - totalVal(sideA);
  const projDiff = totalProj(sideB) - totalProj(sideA);
  const hasPlayers = sideA.length > 0 || sideB.length > 0;

  let verdict = '', verdictColor = 'var(--meta)', verdictDetail = '';
  if (hasPlayers) {
    if (Math.abs(valDiff) < 5 && Math.abs(projDiff) < 2) { verdict = 'FAIR TRADE'; verdictColor = '#6b7280'; verdictDetail = 'Even value — comes down to team needs.'; }
    else if (valDiff > 10 && projDiff > 0) { verdict = 'STRONG WIN'; verdictColor = '#16a34a'; verdictDetail = `You gain ${projDiff.toFixed(1)} pts/wk AND superior long-term value (+${valDiff}).`; }
    else if (valDiff > 5) { verdict = 'YOU WIN'; verdictColor = '#22c55e'; verdictDetail = projDiff < 0 ? `Short-term loss (${projDiff.toFixed(1)} pts/wk) but long-term value gain (+${valDiff}). Dynasty play.` : `You gain both production (+${projDiff.toFixed(1)}) and value (+${valDiff}).`; }
    else if (valDiff < -10 && projDiff < 0) { verdict = 'STRONG LOSS'; verdictColor = '#dc2626'; verdictDetail = `You lose ${Math.abs(projDiff).toFixed(1)} pts/wk AND long-term value (${valDiff}). Avoid.`; }
    else if (valDiff < -5) { verdict = 'YOU LOSE'; verdictColor = '#f97316'; verdictDetail = projDiff > 0 ? `Short-term gain (+${projDiff.toFixed(1)} pts/wk) but selling low on long-term value (${valDiff}). Win-now move.` : `Negative on both axes. Reconsider.`; }
    else { verdict = 'MARGINAL'; verdictColor = '#f59e0b'; verdictDetail = 'Close call — consider your team\'s competitive window.'; }
  }

  // Build verdict explain result
  const verdictResult = hasPlayers ? {
    value: verdict,
    explain: {
      method: 'Dynasty value comparison: sum of dynasty scores for each side + weekly projection delta',
      inputs: {
        sideA_dynasty: totalVal(sideA), sideB_dynasty: totalVal(sideB),
        sideA_proj: Math.round(totalProj(sideA) * 10) / 10, sideB_proj: Math.round(totalProj(sideB) * 10) / 10,
      },
      formula: `Value delta: ${totalVal(sideB)} - ${totalVal(sideA)} = ${valDiff > 0 ? '+' : ''}${valDiff} | Proj delta: ${totalProj(sideB).toFixed(1)} - ${totalProj(sideA).toFixed(1)} = ${projDiff > 0 ? '+' : ''}${projDiff.toFixed(1)} pts/wk`,
      source: 'Dynasty values from engine/dynasty.js, projections from Sleeper API',
      caveats: ['Dynasty values are composite scores, not trade pick equivalents', 'Projections are rest-of-season estimates from Sleeper'],
    },
  } : null;

  const renderSide = (side, setSide, search, setSearch, results, label, sideKey) => html`
    <div class="trade-side">
      <div class="trade-side__title">${label}</div>
      <div style=${{ position: 'relative', marginBottom: 8 }}>
        <input class="search-input" style=${{ fontSize: 12 }} value=${search}
          onInput=${e => setSearch(e.target.value)} placeholder="Search player or team..." />
        ${results.length > 0 && html`
          <div class="search-results" style=${{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}>
            ${results.map(p => html`
              <div key=${p.id} class="search-result" onClick=${() => addPlayer(sideKey, p)}>
                <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)' }}>${p.position}</span>
                <span>${p.first_name} ${p.last_name}</span>
                <span class="text-meta" style=${{ fontSize: 10 }}>${p.team}</span>
              </div>
            `)}
          </div>
        `}
      </div>
      ${side.map((p, i) => {
        const v = getPlayerValue(p);
        return html`
          <div key=${i} class="card--compact" style=${{ marginBottom: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '5px 8px', cursor: 'pointer' }}
            onClick=${() => setExpandedPlayer(expandedPlayer === p.id ? null : p.id)}>
            <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)', width: 22 }}>${p.position}</span>
            <span style=${{ flex: 1, fontSize: 11, fontWeight: 600 }}>
              ${p.first_name} ${p.last_name}
              <span class="text-meta" style=${{ fontSize: 9 }}> ${p.team || 'FA'} · ${p.age || '?'}yo</span>
            </span>
            <${GradeRing} grade=${v.grade.value} size=${26} />
            <span class="text-mono text-blue" style=${{ fontSize: 11, minWidth: 30, textAlign: 'right' }}>${v.projected.toFixed(1)}</span>
            <span onClick=${(e) => { e.stopPropagation(); setSide(s => s.filter((_, j) => j !== i)); }}
              style=${{ fontSize: 14, color: 'var(--red)', cursor: 'pointer' }}>×</span>
          </div>
        `;
      })}
      ${side.length > 0 && html`
        <div class="flex-between" style=${{ marginTop: 6, fontSize: 11, fontWeight: 700 }}>
          <span class="text-meta">Proj: <span class="text-mono text-blue">${totalProj(side).toFixed(1)}</span></span>
          <span style=${{ color: 'var(--navy)' }}>Value: <span class="text-mono">${totalVal(side)}</span></span>
        </div>
      `}
    </div>
  `;

  return html`
    <div class="fade-in" style=${{ margin: '10px 16px' }}>
      <div class="card" style=${{ padding: '16px 20px' }}>
        <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>Trade Analyzer</div>
        <div style=${{ fontSize: 11, color: 'var(--meta)', marginBottom: 14 }}>Projections + stat-based score + age trajectory + dynasty value. Click "Show Math" on the verdict.</div>
        <div class="trade-sides">
          ${renderSide(sideA, setSideA, searchA, setSearchA, resultsA, 'YOU GIVE', 'A')}
          <div class="trade-swap">${'\u21c4'}</div>
          ${renderSide(sideB, setSideB, searchB, setSearchB, resultsB, 'YOU GET', 'B')}
        </div>
        ${hasPlayers && verdict && html`
          <${ExplainPanel} id="verdict" isOpen=${openPanel === 'verdict'} onToggle=${(id) => setOpenPanel(p => p === id ? null : id)} result=${verdictResult}>
            <div class="verdict" style=${{ background: verdictColor + '10', borderLeft: `4px solid ${verdictColor}` }}>
              <div class="verdict__title" style=${{ color: verdictColor }}>${verdict}</div>
              <div class="verdict__detail">${verdictDetail}</div>
              <div class="verdict__stats">
                <span>Proj \u0394: <strong class="text-mono" style=${{ color: projDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>${projDiff >= 0 ? '+' : ''}${projDiff.toFixed(1)}</strong> pts/wk</span>
                <span>Value \u0394: <strong class="text-mono" style=${{ color: valDiff >= 0 ? 'var(--green)' : 'var(--red)' }}>${valDiff >= 0 ? '+' : ''}${valDiff}</strong></span>
              </div>
              <div style=${{ fontSize: 10, color: 'var(--blue)', marginTop: 6, fontWeight: 600 }}>Click to show math \u25bc</div>
            </div>
          <//>
        `}
      </div>
    </div>
  `;
}
