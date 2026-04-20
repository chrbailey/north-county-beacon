# Security

## Responsible Disclosure

If you find a security issue, please do **not** file a public GitHub issue.

Email: chris.bailey@erp-access.com — include "SECURITY: sleeper-scores" in the subject line.

Expect an acknowledgment within 72 hours.

## What this tool does

sleeper-scores is a static website that runs entirely in the visitor's browser. It queries the public Sleeper API (no auth) for player data and Google News RSS via rss2json.com for headlines. Configuration (Sleeper username, leagues, scoring format) is stored in browser localStorage. Cached player data sits in IndexedDB.

## What this tool does NOT do

- It does not run a backend. There is no server, no database, no API keys.
- It does not collect analytics, telemetry, or any data about visitors.
- It does not send user data anywhere. localStorage and IndexedDB stay in the browser.
- It does not require authentication. Sleeper usernames are used only to call the public Sleeper API, which accepts the username as a lookup key with no credentials.
- It does not write to Sleeper — all API calls are read-only.

## Known Considerations

- rss2json.com is a third-party RSS parser used for Google News headlines. If it goes down or changes its policy, the news-buzz feature will fail gracefully. No credentials are sent to it; only the RSS URL.
- The 9MB player database cached in IndexedDB is whatever Sleeper returned. If a user has storage quota issues, this may fail.
- Because everything runs client-side, CORS behavior depends on what the Sleeper API and rss2json.com expose. A change on their side could break the site.
- The site is MIT-licensed and forkable. If you fork it, be mindful that changing the CSP or the fetch endpoints could introduce issues this SECURITY.md does not cover.

If you see evidence of any of the "does NOT do" items, that is a security issue — please report.
