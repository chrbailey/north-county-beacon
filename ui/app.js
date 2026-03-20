// ui/app.js — Root component: data loading, routing, state management

import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import { loadConfig } from '../config.js';
import { getPlayers, getSeasonStats, getProjections, getNFLState } from '../api/sleeper.js';
import { PlayerScout } from './scout.js';
import { TradeAnalyzer } from './trade.js';
import { Settings } from './settings.js';

const html = htm.bind(React.createElement);
const { useState, useEffect, useReducer, useCallback } = React;

// -- State management --

const initialState = {
  players: null,
  stats: {},
  projections: {},
  currentWeek: 1,
  loading: true,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PLAYERS': return { ...state, players: action.data };
    case 'SET_STATS': return { ...state, stats: action.data };
    case 'SET_PROJECTIONS': return { ...state, projections: action.data };
    case 'SET_WEEK': return { ...state, currentWeek: action.data };
    case 'SET_LOADING': return { ...state, loading: action.data };
    case 'SET_ERROR': return { ...state, error: action.data };
    default: return state;
  }
}

// -- App --

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState('scout');
  const [config, setConfig] = useState(() => loadConfig());

  // Data loading sequence
  useEffect(() => {
    dispatch({ type: 'SET_LOADING', data: true });

    (async () => {
      try {
        const nflState = await getNFLState();
        const week = nflState.week || 1;
        dispatch({ type: 'SET_WEEK', data: week });

        const players = await getPlayers();
        dispatch({ type: 'SET_PLAYERS', data: players });

        const [stats, projections] = await Promise.all([
          getSeasonStats(week),
          getProjections(week),
        ]);
        dispatch({ type: 'SET_STATS', data: stats });
        dispatch({ type: 'SET_PROJECTIONS', data: projections });
      } catch (e) {
        console.error('Data load failed:', e);
        dispatch({ type: 'SET_ERROR', data: e.message });
      } finally {
        dispatch({ type: 'SET_LOADING', data: false });
      }
    })();
  }, []);

  const handleSaveConfig = useCallback((newConfig) => {
    setConfig(newConfig);
  }, []);

  const { players, stats, projections, currentWeek, loading, error } = state;

  return html`
    <div class="app-container">

      <div class="nav-bar">
        <div class="nav-logo" onClick=${() => setView('scout')}>
          <div class="nav-logo-mark">SS</div>
          <div>
            <div class="nav-title">sleeper-scores</div>
            <div class="nav-subtitle">FANTASY INTELLIGENCE · EVERY NUMBER SHOWS ITS MATH</div>
          </div>
        </div>
        <div class="nav-tabs">
          ${[
            { id: 'scout', label: '🔬 Scout' },
            { id: 'trade', label: '🔄 Trade' },
            { id: 'settings', label: '⚙️ Settings' },
          ].map(tab => html`
            <button key=${tab.id} class=${`nav-tab ${view === tab.id ? 'nav-tab--active' : 'nav-tab--inactive'}`}
              onClick=${() => setView(tab.id)}>
              ${tab.label}
            </button>
          `)}
        </div>
      </div>


      ${loading ? html`
        <div style=${{ padding: '60px 20px', textAlign: 'center' }}>
          <div class="loading-pulse" style=${{ fontSize: 14, color: 'var(--meta)', marginBottom: 12 }}>
            Loading player database from Sleeper API...
          </div>
          <div style=${{ fontSize: 11, color: 'var(--meta)' }}>
            First load fetches ~9MB of player data. Subsequent visits load from cache instantly.
          </div>
        </div>
      ` : error ? html`
        <div style=${{ padding: '40px 20px', textAlign: 'center', color: 'var(--red)' }}>
          <div style=${{ fontSize: 14, marginBottom: 8 }}>Failed to load data</div>
          <div style=${{ fontSize: 12 }}>${error}</div>
          <button class="btn btn--primary" style=${{ marginTop: 12 }} onClick=${() => location.reload()}>Retry</button>
        </div>
      ` : html`
        ${view === 'scout' && html`
          <${PlayerScout} players=${players} stats=${stats} projections=${projections}
            currentWeek=${currentWeek} scoringFormat=${config.scoringFormat} />
        `}
        ${view === 'trade' && html`
          <${TradeAnalyzer} players=${players} stats=${stats} projections=${projections}
            currentWeek=${currentWeek} scoringFormat=${config.scoringFormat} />
        `}
        ${view === 'settings' && html`
          <${Settings} config=${config} onSave=${handleSaveConfig} />
        `}
      `}


      <div class="footer">
        <div class="footer__title">sleeper-scores</div>
        <div class="footer__sub">Every number shows its math. Fork it on GitHub.</div>
        <div class="footer__link" style=${{ marginTop: 6 }}>Built with Claude.</div>
      </div>
    </div>
  `;
}

// -- Error Boundary --
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('React Error Boundary:', error, info); }
  render() {
    if (this.state.error) {
      return html`
        <div style=${{ padding: 40, textAlign: 'center', fontFamily: 'var(--font)' }}>
          <div style=${{ fontSize: 16, color: 'var(--red)', marginBottom: 8 }}>Something went wrong</div>
          <pre style=${{ fontSize: 11, color: 'var(--meta)', textAlign: 'left', maxWidth: 600, margin: '0 auto', whiteSpace: 'pre-wrap', background: 'var(--surface)', padding: 12, borderRadius: 6 }}>${this.state.error.toString()}\n${this.state.error.stack || ''}</pre>
          <button class="btn btn--primary" style=${{ marginTop: 12 }} onClick=${() => { this.setState({ error: null }); location.reload(); }}>Reload</button>
        </div>
      `;
    }
    return this.props.children;
  }
}

// -- Mount --
const root = createRoot(document.getElementById('root'));
root.render(html`<${ErrorBoundary}><${App} /><//>`);

