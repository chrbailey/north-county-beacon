// api/news.js — Google News RSS fetch via rss2json.com

export async function fetchHeadlines(query) {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'ok' || !data.items) return [];

    return data.items.map(item => {
      const title = (item.title || '').replace(/\s+-\s+[^-]+$/, '');
      const sourceMatch = (item.title || '').match(/\s+-\s+(.+)$/);
      const source = sourceMatch ? sourceMatch[1] : 'News';
      return { title, source, date: new Date(item.pubDate || 0), link: item.link };
    });
  } catch (e) {
    console.warn('fetchHeadlines failed:', e);
    return [];
  }
}
