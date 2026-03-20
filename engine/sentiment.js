// engine/sentiment.js — News keyword buzz scoring with explainable results
// Label: "News Buzz (keyword matching)" — NOT "sentiment engine"
// NOTE: No imports from api/ — headlines are passed in by the caller (UI layer)

export const POSITIVE_KEYWORDS = [
  'breakout', 'elite', 'dominant', 'career high', 'record', 'star',
  'surge', 'boom', 'top', 'best', 'mvp', 'pro bowl', 'extension',
  'deal', 'clutch', 'explosive', 'unstoppable', 'rising',
];

export const NEGATIVE_KEYWORDS = [
  'injury', 'injured', 'bust', 'decline', 'drop', 'worst', 'benched',
  'cut', 'suspend', 'arrested', 'questionable', 'doubt', 'concern',
  'struggle', 'fumble', 'interception', 'hamstring', 'acl',
  'concussion', 'limited', 'downgrade', 'out for',
];

export async function fetchPlayerSentiment(playerName, headlines) {
  if (!headlines || headlines.length === 0) {
    return {
      value: 0,
      headlines: [],
      volume: 0,
      narrative: 'News feed unavailable',
      explain: {
        method: 'No headlines retrieved',
        inputs: { query: playerName + ' NFL', articlesScanned: 0 },
        formula: 'N/A',
        source: 'Google News RSS via rss2json.com',
        caveats: ['News feed unavailable — rss2json.com may be down or rate-limited'],
      },
    };
  }

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const recentCount = headlines.filter(h => h.date.getTime() > weekAgo).length;

  let posCount = 0, negCount = 0;
  const posMatches = [], negMatches = [];

  headlines.forEach(h => {
    const t = h.title.toLowerCase();
    POSITIVE_KEYWORDS.forEach(kw => {
      if (t.includes(kw)) { posCount++; posMatches.push(kw); }
    });
    NEGATIVE_KEYWORDS.forEach(kw => {
      if (t.includes(kw)) { negCount++; negMatches.push(kw); }
    });
  });

  const total = posCount + negCount || 1;
  const score = Math.max(-100, Math.min(100, Math.round(((posCount - negCount) / total) * 100)));

  let narrative;
  if (posCount > negCount * 2) narrative = 'Strong positive buzz. Media narrative is overwhelmingly favorable.';
  else if (posCount > negCount) narrative = 'Positive sentiment. More upside mentions than concerns.';
  else if (negCount > posCount * 2) narrative = 'Significant negative buzz. Injury or performance concerns dominate.';
  else if (negCount > posCount) narrative = 'Negative sentiment. Concerns outweigh positive coverage.';
  else narrative = 'Neutral coverage. No strong directional narrative.';

  // Deduplicate match lists for display
  const posUnique = [...new Set(posMatches)];
  const negUnique = [...new Set(negMatches)];

  return {
    value: score,
    headlines: headlines.slice(0, 8),
    volume: recentCount,
    narrative,
    explain: {
      method: 'Keyword frequency scoring on Google News headlines',
      inputs: {
        query: playerName + ' NFL',
        articlesScanned: headlines.length,
        positiveMatches: posCount,
        negativeMatches: negCount,
        positiveKeywords: posUnique,
        negativeKeywords: negUnique,
      },
      formula: `(${posCount} positive - ${negCount} negative) / ${total} total x 100 = ${score}`,
      source: 'Google News RSS via rss2json.com',
      caveats: [
        'Keyword counting only — no NLP, no negation detection ("not injured" scores as negative)',
        'Headline text only — does not read article bodies',
        `Limited to ${headlines.length} articles from Google News RSS`,
        'No source authority weighting — ESPN and a fan blog count equally',
      ],
    },
  };
}
