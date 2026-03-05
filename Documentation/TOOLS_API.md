# Tools API (Stage 1)

Canonical endpoint: `POST /api/tools`

Compatibility alias: `POST /api/ai/tools` (rewritten to `/api/tools` in `vercel.json`)

## Request format

```json
{
  "tool": "getWorkoutHistory",
  "arguments": {}
}
```

## Response format

Success:

```json
{
  "success": true,
  "tool_call": {
    "name": "getWorkoutHistory",
    "input": {
      "limit": 5
    }
  },
  "tool_result": {}
}
```

Error:

```json
{
  "success": false,
  "error": "message",
  "code": "CODE"
}
```

## curl examples

### 1) getWorkoutHistory

```bash
curl -X POST https://your-app.vercel.app/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "getWorkoutHistory",
    "arguments": { "limit": 5 }
  }'
```

### 2) getExerciseProgress

```bash
curl -X POST https://your-app.vercel.app/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "getExerciseProgress",
    "arguments": {
      "exercise_id": "123e4567-e89b-42d3-a456-426614174000",
      "limit": 20
    }
  }'
```

### 3) logSet

```bash
curl -X POST https://your-app.vercel.app/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "logSet",
    "arguments": {
      "workout_id": "123e4567-e89b-42d3-a456-426614174010",
      "exercise_id": "123e4567-e89b-42d3-a456-426614174011",
      "weight_kg": 100,
      "reps": 5,
      "rpe": 8
    }
  }'
```

### 4) createTrainingPlan (skeleton)

```bash
curl -X POST https://your-app.vercel.app/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "createTrainingPlan",
    "arguments": {
      "name": "AI Strength Plan",
      "goal": "strength",
      "days_per_week": 4,
      "duration_weeks": 8,
      "description": "Minimal skeleton plan"
    }
  }'
```
