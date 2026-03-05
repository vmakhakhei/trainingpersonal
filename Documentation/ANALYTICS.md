# Analytics Engine (Stage 2)

## Overview

This stage adds analytics materialized views and a single API endpoint:

- SQL migration: `supabase/analytics_mviews.sql`
- API endpoint: `GET/POST /api/analytics`
- Routing mode: one Vercel serverless file (`api/analytics/index.js`)

Timezone baseline: `Europe/Warsaw`.

## Materialized Views

Created by migration:

1. `analytics_workout_summary_mv`
- Aggregate per workout.
- Main fields for API: `workout_id`, `workout_date`, `total_volume_kg`, `top_exercises`.

2. `analytics_exercise_progress_mv`
- Time series by `exercise_id` and `workout_date`.
- Main fields: `exercise_id`, `exercise_name`, `workout_date`, `total_volume_kg`, `total_reps`, `sets_count`, `max_weight_kg`, `estimated_1rm`.

3. `analytics_muscle_volume_mv`
- Daily aggregates by muscle group.
- Main fields: `workout_date`, `muscle`, `total_sets`, `total_volume_kg`.

Extra objects:

- `analytics_refresh_log` table
- `refresh_analytics_materialized_views(p_use_concurrently boolean)` function
  - tries `REFRESH MATERIALIZED VIEW CONCURRENTLY`
  - falls back to non-concurrent refresh
  - writes refresh result to `analytics_refresh_log`

## API Contract

### GET /api/analytics?op=workout_summary&limit=5

Response:

```json
{
  "success": true,
  "data": [
    {
      "workout_id": "...",
      "workout_date": "2026-03-05",
      "total_volume_kg": 10000,
      "top_exercises": []
    }
  ]
}
```

### GET /api/analytics?op=exercise_progress&exercise_id=<uuid>&limit=20

Response:

```json
{
  "success": true,
  "data": [
    {
      "exercise_id": "...",
      "exercise_name": "Жим лёжа",
      "workout_date": "2026-03-05",
      "total_volume_kg": 3500,
      "total_reps": 25,
      "sets_count": 5,
      "max_weight_kg": 100,
      "estimated_1rm": 110
    }
  ]
}
```

### GET /api/analytics?op=muscle_volume&from=YYYY-MM-DD&to=YYYY-MM-DD&muscle=chest

Response:

```json
{
  "success": true,
  "data": [
    {
      "workout_date": "2026-03-05",
      "muscle": "chest",
      "total_sets": 10,
      "total_volume_kg": 5400
    }
  ]
}
```

### POST /api/analytics?op=refresh

Required header:

- `x-service-role: $SUPABASE_SERVICE_ROLE_KEY`

Response:

```json
{
  "success": true,
  "result": {
    "ok": true,
    "duration_seconds": 0.21,
    "used_concurrently": true,
    "refreshed_at": "2026-03-05T19:00:00.000Z"
  },
  "log_id": 101
}
```

Errors:

- `400` bad args
- `401` unauthorized refresh
- `405` method not allowed
- `500` internal/refresh failure

## curl Examples

```bash
curl "https://your-app.vercel.app/api/analytics?op=workout_summary&limit=3"
```

```bash
curl "https://your-app.vercel.app/api/analytics?op=exercise_progress&exercise_id=<uuid>&limit=5"
```

```bash
curl "https://your-app.vercel.app/api/analytics?op=muscle_volume&from=2026-03-01&to=2026-03-31&muscle=chest"
```

```bash
curl -X POST "https://your-app.vercel.app/api/analytics?op=refresh" \
  -H "x-service-role: $SUPABASE_SERVICE_ROLE_KEY"
```

## Refresh Scheduling (Cron)

### Option A: Vercel Cron + protected refresh endpoint

In `vercel.json` (example):

```json
{
  "crons": [
    {
      "path": "/api/analytics?op=refresh",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

For protected refresh, use an intermediate secure trigger (for example GitHub Action or server-side cron runner) that sends `x-service-role`.

### Option B: GitHub Actions (recommended for custom headers)

Run every 6 hours and call:

```bash
curl -X POST "https://your-app.vercel.app/api/analytics?op=refresh" \
  -H "x-service-role: $SUPABASE_SERVICE_ROLE_KEY"
```

Store `SUPABASE_SERVICE_ROLE_KEY` as a GitHub Actions secret.
