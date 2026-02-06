# Concert Notify

Discover upcoming concerts for artists you listen to on Spotify.

## What It Does

Concert Notify connects to your Spotify account, analyzes your listening habits (top artists and liked songs), and matches them against upcoming concert listings scraped from OhMyRockness.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SCRAPER                                  │
│   (runs on schedule or manually)                                │
│                                                                  │
│   OhMyRockness ──► Puppeteer ──► Parse ──► data/shows.json     │
└─────────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         WEB APP                                  │
│                                                                  │
│   Browser ◄──► Express Server ◄──► Spotify API                  │
│      │              │                                           │
│      │              ▼                                           │
│      │        data/shows.json                                   │
│      │              │                                           │
│      ▼              ▼                                           │
│   Match user's artists against shows, display results           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Scraper** runs periodically (cron) or manually
2. Scraper fetches pages from OhMyRockness, extracts show data
3. Scraper writes clean JSON to `data/shows.json`
4. **Web app** user logs in with Spotify
5. Web app fetches user's top artists + liked song artists from Spotify
6. Web app loads `data/shows.json`
7. Frontend matches artists → shows, displays results

## Quick Start

### Prerequisites

- Node.js 18+
- A Spotify Developer account

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Spotify credentials

# 3. Run the scraper to get initial data
npm run scrape

# 4. Start the web server
npm start

# 5. Open http://localhost:8888
```

## Project Structure

```
concert-notify/
├── src/
│   ├── server.js              # Express app entry point
│   ├── config/
│   │   └── index.js           # Centralized configuration
│   ├── routes/
│   │   ├── auth.js            # OAuth routes (/login, /callback)
│   │   └── api.js             # API routes (/api/*)
│   ├── services/
│   │   ├── spotify.js         # Spotify API client
│   │   ├── shows.js           # Show data loader
│   │   └── tokenStore.js      # In-memory session storage
│   ├── scraper/
│   │   ├── index.js           # Scraper entry point
│   │   ├── config.js          # Scraper settings & selectors
│   │   └── parsers.js         # HTML parsing logic
│   └── shared/
│       ├── types.js           # Show schema & validation
│       ├── normalize.js       # Artist name normalization
│       └── logger.js          # Structured logging
├── public/
│   ├── index.html
│   ├── app.js                 # Frontend logic
│   └── style.css
├── data/
│   └── shows.json             # Scraped show data (gitignored)
├── tests/
├── .env.example
└── package.json
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the web server |
| `npm run dev` | Start in development mode |
| `npm run scrape` | Run the scraper, save to data/shows.json |
| `npm run scrape:dry` | Run scraper without saving (preview) |
| `npm test` | Run tests |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /login` | Initiates Spotify OAuth flow |
| `GET /callback` | OAuth callback handler |
| `GET /refresh_token` | Refresh an expired token |
| `GET /api/top-artists` | User's top 50 artists |
| `GET /api/liked-artists` | Artists from liked songs |
| `GET /api/upcoming-shows` | Upcoming concert listings |

## Show Data Format

The scraper outputs and web app expects this flat structure:

```json
{
  "artists": ["Artist 1", "Artist 2"],
  "venue": "Brooklyn Steel",
  "date": "6/15/2025",
  "time": "8:00 PM"
}
```

## Scraper Notes

The scraper depends on OhMyRockness's HTML structure. When the site changes:

1. Run `npm run scrape:dry` to see what's breaking
2. Update selectors in `src/scraper/config.js`
3. Test with `LOG_LEVEL=debug npm run scrape:dry`

Key selectors are documented in `src/scraper/config.js`.

## Known Limitations

- **Session Storage**: Tokens are stored in memory. Server restart = logout.
- **Scraper Fragility**: Depends on OhMyRockness HTML structure.
- **No Rate Limiting**: Heavy usage could hit Spotify's API limits.
- **Single Region**: Currently only scrapes NYC shows.

## Testing

```bash
npm test
```

Tests cover:
- Artist name normalization
- Show matching logic
- Type validation

## Future Improvements

- [ ] Persistent session storage (Redis/DB)
- [ ] Scheduled scraper runs (cron)
- [ ] Email notifications for new matches
- [ ] Multiple city support
- [ ] Rate limiting middleware

## License

MIT
