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

// -- Sub-components to avoid ternary chains in htm --

function NavBar({ view, setView }) {
  const tabs = [
    { id: 'scout', label: 'Scout' },
    { id: 'trade', label: 'Trade' },
    { id: 'settings', label: 'Settings' },
  ];
  return html`
    <div class="nav-bar">
      <div class="nav-logo" onClick=${() => setView('scout')}>
        <div class="nav-logo-mark">SS</div>
        <div>
          <div class="nav-title">sleeper-scores</div>
          <div class="nav-subtitle">FANTASY INTELLIGENCE</div>
        </div>
      </div>
      <div class="nav-tabs">
        ${tabs.map(tab => html`
          <button key=${tab.id}
            class=${view === tab.id ? 'nav-tab nav-tab--active' : 'nav-tab nav-tab--inactive'}
            onClick=${() => setView(tab.id)}>
            ${tab.label}
          </button>
        `)}
      </div>
    </div>
  `;
}

function LoadingView() {
  return html`
    <div style=${{ padding: '60px 20px', textAlign: 'center' }}>
      <div class="loading-pulse" style=${{ fontSize: 14, color: 'var(--meta)', marginBottom: 12 }}>
        Loading player database from Sleeper API...
      </div>
      <div style=${{ fontSize: 11, color: 'var(--meta)' }}>
        First load fetches player data. Subsequent visits load from cache instantly.
      </div>
    </div>
  `;
}

function ErrorView({ error }) {
  return html`
    <div style=${{ padding: '40px 20px', textAlign: 'center', color: 'var(--red)' }}>
      <div style=${{ fontSize: 14, marginBottom: 8 }}>Failed to load data</div>
      <div style=${{ fontSize: 12 }}>${String(error)}</div>
      <button class="btn btn--primary" style=${{ marginTop: 12 }} onClick=${() => location.reload()}>Retry</button>
    </div>
  `;
}

function ContentView({ view, players, stats, projections, currentWeek, scoringFormat, config, onSaveConfig }) {
  if (view === 'scout') {
    return html`<${PlayerScout} players=${players} stats=${stats} projections=${projections}
      currentWeek=${currentWeek} scoringFormat=${scoringFormat} />`;
  }
  if (view === 'trade') {
    return html`<${TradeAnalyzer} players=${players} stats=${stats} projections=${projections}
      currentWeek=${currentWeek} scoringFormat=${scoringFormat} />`;
  }
  if (view === 'settings') {
    return html`<${Settings} config=${config} onSave=${onSaveConfig} />`;
  }
  return null;
}

function Footer() {
  return html`
    <div class="footer">
      <div class="footer__title">sleeper-scores</div>
      <div class="footer__sub">Every number shows its math. Fork it on GitHub.</div>
      <div class="footer__link" style=${{ marginTop: 6 }}>Built with Claude.</div>
    </div>
  `;
}

// -- App --

function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [view, setView] = useState('scout');
  const [config, setConfig] = useState(() => loadConfig());

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

  let content;
  if (loading) {
    content = html`<${LoadingView} />`;
  } else if (error) {
    content = html`<${ErrorView} error=${error} />`;
  } else {
    content = html`<${ContentView} view=${view} players=${players} stats=${stats}
      projections=${projections} currentWeek=${currentWeek}
      scoringFormat=${config.scoringFormat} config=${config}
      onSaveConfig=${handleSaveConfig} />`;
  }

  return html`
    <div class="app-container">
      <${NavBar} view=${view} setView=${setView} />
      ${content}
      <${Footer} />
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
      const errStr = this.state.error.toString();
      const stack = this.state.error.stack || '';
      return html`
        <div style=${{ padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>
          <div style=${{ fontSize: 16, color: '#dc2626', marginBottom: 8 }}>Something went wrong</div>
          <pre style=${{ fontSize: 11, color: '#6b7280', textAlign: 'left', maxWidth: 600, margin: '0 auto', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: 12, borderRadius: 6 }}>${errStr + '\n' + stack}</pre>
          <button style=${{ marginTop: 12, padding: '8px 20px', background: '#1a2744', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick=${() => location.reload()}>Reload</button>
        </div>
      `;
    }
    return this.props.children;
  }
}

// -- Mount --
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(ErrorBoundary, null, React.createElement(App)));
