# Bienenstand

Mobile-first dashboard for four Dadant colonies. Vite + TypeScript + Chart.js, Vercel Node API functions, Neon PostgreSQL with Drizzle query/schema definitions.

## Data model

The existing `hive_measurements` table and all historical measurements are preserved. The composite primary key `(hive_key, measured_at)` prevents duplicate samples. Sync only appends (`ON CONFLICT DO NOTHING`); it never truncates or expires raw history. Times are stored as UTC timestamptz and displayed in Europe/Berlin.

`migrations/001_sync.sql` adds per-channel watermarks and an atomic expiring global sync lease. Run `npm run migrate` with `.env.local` containing DATABASE_URL before deploying the API. Test migrations on a Neon branch first. No database credentials belong in Git or browser code.

## Import

`POST /api/sync` imports the four fixed, public ThingSpeak sources. The endpoint accepts no arbitrary source, SQL, weight or date input. A database lease serializes imports and limits public triggering to once every two minutes. The legacy `/api/cron` route uses the same lease. This is deliberately a public, bounded import trigger because all source data is public; it is not a general write API.

- Fetch <=100 recent channel entries to avoid cached large feed responses.
- Fetch at most three daily catch-up windows per channel per run.
- Replay the preceding hour; persist measurements and checkpoint atomically.
- Split saturated 8000-entry responses recursively instead of silently losing older records.
- Invalid/empty values are discarded; zero is never manufactured from null.
- Channels fail independently; partial failures produce a non-2xx response and persisted error state.
- HTTP timeouts, expiring lease and idempotent retries recover after interruptions.
- Older manual imports use `npm run backfill -- YYYY-MM-DD YYYY-MM-DD` with a privileged server-side DATABASE_URL. The old public backfill endpoint returns 410.

GitHub Actions `.github/workflows/archive-thingspeak.yml` triggers every 15 minutes (07/22/37/52), retries failed requests and validates the JSON body. GitHub does not guarantee exact start times and may disable inactive public-repository schedules after prolonged inactivity. Monitor Actions and the visible import timestamp. Manual refresh remains available.

## Read API

`GET /api/history?days=1|7|30|365` returns four colony summaries, per-channel import status and bounded chart series. Differences are relative to each colony's latest reading, with a reference sample at or up to 60 minutes before the 24h/7d target. Missing references return null. Data older than 60 minutes is visibly stale.

The database selects first/minimum/maximum/last in each 5-minute, 30-minute, 2-hour or daily bucket. Raw samples remain intact. Index-backed latest/reference reads and server-side reduction avoid downloading an entire year. Chart gaps are broken, not filled with fabricated measurements. The change comparison resets each colony to its first available sample in the selected interval.

Anomaly hints flag >=2 kg jumps between adjacent readings no more than 30 minutes apart in the last 24 hours. They do not diagnose swarms or food reserves.

## Development and checks

```
npm ci
npm test
npm run build
npm run migrate
node --env-file=.env.local --import tsx scripts/verify.ts
```

The integration verification imports real public source values into the configured database. Use a Neon test branch. It checks history preservation, unique timestamps, repeat throttling, all four ranges and summary values. `npm run dev` serves the frontend; hosted API functions require a Vercel preview or compatible local API routing.

## Release

1. Create a preview using a Neon branch and apply additive migrations there.
2. Validate data, sync, ranges, chart controls and responsive UI.
3. Apply the identical additive migration to production.
4. Deploy the tested code with production DATABASE_URL and update main.
5. Verify `/api/history`, a real `/api/sync`, and a scheduled GitHub run.

Rollback: redeploy the previous production revision. Additive sync tables do not interfere with the former application. Never delete `hive_measurements`.

## Bienenjahr

Monthly orientation adapted for Dadant, Nassenheider formic-acid summer treatment and oxalic-acid sublimation in winter. Weather, colony development, forage and measured Varroa infestation always take precedence. Product instructions, approved uses and required protective equipment govern treatment; the dashboard does not provide doses.

Sources: LWG Bienenpflege, Sommerbehandlung, Winterbehandlung (linked in the app).
