# XLab Region Activity Dashboard

A local, desktop-first dashboard for monitoring gameplay activity from the Cloudflare worker namespaces:

- JaroX (`/leaderboard?mode=global`)
- Olyx (`/olyx/leaderboard?mode=global`)

## Quick start (local run)

```bash
python3 -m http.server 8080
```

Open in browser:

- `http://localhost:8080`

## What this dashboard includes

- Premium desktop layout with dark visual style and clear data hierarchy.
- Summary cards for Olyx, JaroX, combined plays, active regions, and tracked players.
- Filter/sort controls (search, game type, region, sort by player/score/region/plays, direction).
- Sticky-header table with hover states and details drawer.
- Player ranking list with per-player score and play count.
- Empty/loading/no-result states.
- Fallback demo dataset if worker fetch fails.

## Worker connection

Use the **Worker Base URL** field and click **Connect**.

The URL is stored in `localStorage` under:

- `xlab_worker_url`

## Can I hide or encrypt the workers.dev URL?

Short answer: **not fully in a client-only page**.

If the browser can call an endpoint directly, advanced users can still discover it from DevTools/network logs.

What you can do:

1. Put a backend/proxy between page and worker (best option).
2. Restrict worker access by token/rules/rate limits.
3. Optional light obfuscation only (not security):
   - `?worker_key=<base64-url>` query parameter is supported and decoded client-side.

## View controls (new)

- **Text Size** controls (`A-`, `A+`, `Reset`)
- **Dashboard Zoom** controls (`-`, `+`, `Reset`)

Both are persisted in `localStorage`:

- `xlab_text_scale`
- `xlab_ui_scale`
