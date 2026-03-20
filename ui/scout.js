// ui/scout.js — Player search + results table + intelligence card expansion

import { React, html } from './htm.js';
import { PlayerIntelligenceCard } from './card.js';
import { computeCompositeGrade, gradeColor } from '../engine/grades.js';
import { calcFantasyPts } from '../engine/scoring.js';
import { PositionBadge, POS_COLORS, NFL_TEAMS } from './primitives.js';

const { useState, useEffect, useMemo } = React;

export function PlayerScout({ players, stats, projections, currentWeek, scoringFormat }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [posFilter, setPosFilter] = useState('ALL');

  const playerCount = useMemo(() => players ? Object.keys(players).length : 0, [players]);

  const results = useMemo(() => {
    if (!query || query.length < 2 || !players || playerCount === 0) return [];
    const q = query.toLowerCase();
    return Object.entries(players)
      .filter(([id, p]) => {
        const isActive = p.status === 'Active' || p.active === true || (p.team && p.team !== '');
        const validPos = p.position && ['QB','RB','WR','TE','K','DEF'].includes(p.position);
        const posMatch = posFilter === 'ALL' || p.position === posFilter;
        const teamFull = NFL_TEAMS[p.team] || '';
        const nameMatch = (`${p.first_name || ''} ${p.last_name || ''}`).toLowerCase().includes(q) || (p.team || '').toLowerCase().includes(q) || teamFull.includes(q);
        return isActive && validPos && posMatch && nameMatch;
      })
      .map(([id, p]) => {
        const grade = computeCompositeGrade(stats[id] || {}, p.position);
        const projected = calcFantasyPts(projections[id] || {}, scoringFormat || 'ppr');
        return { id, ...p, grade, projected: projected.value };
      })
      .sort((a, b) => b.grade.value - a.grade.value || b.projected - a.projected)
      .slice(0, 25);
  }, [query, players, playerCount, posFilter, stats, projections, scoringFormat]);

  return html`
    <div class="fade-in" style=${{ margin: '10px 16px' }}>
      <div style=${{ marginBottom: 4 }}>
        <div style=${{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Player Intelligence Scout</div>
        <div style=${{ fontSize: 11, color: 'var(--meta)' }}>Stat-based score + trend analysis + news buzz + scouting report. Click any number to see the math.</div>
      </div>

      <div style=${{ display: 'flex', gap: 6, marginBottom: 10, marginTop: 10 }}>
        <input class="search-input" value=${query}
          onInput=${e => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Search player name or NFL team..." />
        ${['ALL', 'QB', 'RB', 'WR', 'TE'].map(pos => html`
          <button key=${pos} onClick=${() => { setPosFilter(pos); setSelected(null); }}
            class="nav-tab" style=${{
              fontWeight: posFilter === pos ? 700 : 400, fontSize: 11,
              background: posFilter === pos ? (POS_COLORS[pos] || 'var(--navy)') : 'var(--surface)',
              color: posFilter === pos ? '#fff' : 'var(--meta)',
              border: posFilter === pos ? 'none' : '1px solid var(--border)',
            }}>${pos}</button>
        `)}
      </div>

      ${selected ? html`
        <div>
          <div onClick=${() => setSelected(null)} style=${{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer', marginBottom: 8 }}>← Back to results</div>
          <${PlayerIntelligenceCard} player=${selected} stats=${stats} projections=${projections}
            currentWeek=${currentWeek} scoringFormat=${scoringFormat} onClose=${() => setSelected(null)} />
        </div>
      ` : results.length > 0 ? html`
        <div class="results-table">
          <div class="results-table__header">
            <span>POS</span><span>NAME</span><span>TEAM</span><span>AGE</span><span>GRADE</span><span>PROJ</span><span></span>
          </div>
          ${results.map(p => html`
            <div key=${p.id} class="results-table__row" onClick=${() => setSelected(p)}>
              <span style=${{ fontSize: 10, fontWeight: 700, color: POS_COLORS[p.position] || 'var(--meta)' }}>${p.position}</span>
              <span style=${{ fontWeight: 600 }}>
                ${p.first_name} ${p.last_name}
                ${p.injury_status && html`<span style=${{ fontSize: 9, color: 'var(--red)', marginLeft: 4 }}>${p.injury_status}</span>`}
              </span>
              <span class="text-meta" style=${{ fontSize: 10 }}>${p.team || 'FA'}</span>
              <span class="text-meta text-mono" style=${{ fontSize: 10 }}>${p.age || '?'}</span>
              <span class="text-mono" style=${{ fontSize: 11, fontWeight: 700, color: gradeColor(p.grade.value) }}>${p.grade.value}</span>
              <span class="text-mono" style=${{ fontSize: 11, color: p.projected > 10 ? 'var(--green)' : 'var(--meta)' }}>${p.projected.toFixed(1)}</span>
              <span style=${{ fontSize: 10, color: 'var(--blue)', fontWeight: 600 }}>Intel →</span>
            </div>
          `)}
        </div>
      ` : query.length >= 2 ? html`
        <div style=${{ padding: 20, textAlign: 'center', color: 'var(--meta)', fontSize: 13 }}>No active players found matching "${query}".</div>
      ` : html`
        <div style=${{ padding: 30, textAlign: 'center', color: 'var(--meta)', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style=${{ fontSize: 24, marginBottom: 8 }}>🔬</div>
          <div style=${{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Player Intelligence Database</div>
          <div style=${{ fontSize: 12 }}>
            ${playerCount > 0 ? `${playerCount.toLocaleString()} players loaded. Search by name or NFL team.` : 'Loading player database...'}
          </div>
        </div>
      `}
    </div>
  `;
}
