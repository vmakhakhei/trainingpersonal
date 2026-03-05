import { describe, expect, it, vi } from 'vitest';
import {
  createAnalyticsHandler,
  executeReadOperation,
  executeRefreshOperation
} from '../../api/analytics/index.js';

function createMockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function createWorkoutSummaryClient(data = [{ workout_id: 'w1' }]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data, error: null }))
  };

  return {
    from: vi.fn(() => chain),
    chain
  };
}

function createExerciseProgressClient(data = [{ exercise_id: 'e1' }]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(async () => ({ data, error: null }))
  };

  return {
    from: vi.fn(() => chain),
    chain
  };
}

function createMuscleVolumeClient(data = [{ muscle: 'chest' }]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject)
  };

  return {
    from: vi.fn(() => chain),
    chain
  };
}

describe('analytics read operations', () => {
  it('uses workout summary materialized view', async () => {
    const { from, chain } = createWorkoutSummaryClient();

    const data = await executeReadOperation({
      op: 'workout_summary',
      query: { limit: '3' },
      userId: '123e4567-e89b-42d3-a456-426614174000',
      supabaseClient: { from }
    });

    expect(from).toHaveBeenCalledWith('analytics_workout_summary_mv');
    expect(chain.eq).toHaveBeenCalledWith('user_id', '123e4567-e89b-42d3-a456-426614174000');
    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(data).toEqual([{ workout_id: 'w1' }]);
  });

  it('uses exercise progress materialized view', async () => {
    const { from, chain } = createExerciseProgressClient();

    const data = await executeReadOperation({
      op: 'exercise_progress',
      query: {
        exercise_id: '123e4567-e89b-42d3-a456-426614174001',
        limit: '20'
      },
      userId: '123e4567-e89b-42d3-a456-426614174000',
      supabaseClient: { from }
    });

    expect(from).toHaveBeenCalledWith('analytics_exercise_progress_mv');
    expect(chain.eq).toHaveBeenNthCalledWith(1, 'user_id', '123e4567-e89b-42d3-a456-426614174000');
    expect(chain.eq).toHaveBeenNthCalledWith(2, 'exercise_id', '123e4567-e89b-42d3-a456-426614174001');
    expect(chain.limit).toHaveBeenCalledWith(20);
    expect(data).toEqual([{ exercise_id: 'e1' }]);
  });

  it('uses muscle volume materialized view with filters', async () => {
    const { from, chain } = createMuscleVolumeClient();

    const data = await executeReadOperation({
      op: 'muscle_volume',
      query: {
        from: '2026-01-01',
        to: '2026-01-31',
        muscle: 'chest'
      },
      userId: '123e4567-e89b-42d3-a456-426614174000',
      supabaseClient: { from }
    });

    expect(from).toHaveBeenCalledWith('analytics_muscle_volume_mv');
    expect(chain.eq).toHaveBeenCalledWith('user_id', '123e4567-e89b-42d3-a456-426614174000');
    expect(chain.gte).toHaveBeenCalledWith('workout_date', '2026-01-01');
    expect(chain.lte).toHaveBeenCalledWith('workout_date', '2026-01-31');
    expect(chain.eq).toHaveBeenCalledWith('muscle', 'chest');
    expect(data).toEqual([{ muscle: 'chest' }]);
  });
});

describe('analytics refresh operations', () => {
  it('rejects refresh without valid x-service-role header', async () => {
    await expect(
      executeRefreshOperation({
        req: { headers: {} },
        query: { op: 'refresh' },
        supabaseClient: { rpc: vi.fn() },
        serviceRoleKey: 'secret-key'
      })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401
    });
  });

  it('calls refresh RPC and returns normalized result', async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          ok: true,
          duration_seconds: 0.12,
          used_concurrently: true,
          refreshed_at: '2026-03-05T00:00:00Z',
          log_id: 42
        }
      ],
      error: null
    }));

    const result = await executeRefreshOperation({
      req: {
        headers: { 'x-service-role': 'secret-key' },
        body: {}
      },
      query: { op: 'refresh' },
      supabaseClient: { rpc },
      serviceRoleKey: 'secret-key'
    });

    expect(rpc).toHaveBeenCalledWith('refresh_analytics_materialized_views', {
      p_use_concurrently: true
    });

    expect(result).toEqual({
      ok: true,
      duration_seconds: 0.12,
      used_concurrently: true,
      refreshed_at: '2026-03-05T00:00:00Z',
      log_id: 42
    });
  });
});

describe('analytics handler', () => {
  it('returns 405 for unsupported methods', async () => {
    const handler = createAnalyticsHandler();
    const res = createMockRes();

    await handler({ method: 'PUT', query: {} }, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({
      success: false,
      code: 'METHOD_NOT_ALLOWED'
    });
  });

  it('returns read payload for GET op', async () => {
    const handler = createAnalyticsHandler({
      getUserId: () => '123e4567-e89b-42d3-a456-426614174000',
      executeReadOperation: async () => [{ workout_id: 'w1' }]
    });

    const res = createMockRes();

    await handler({ method: 'GET', query: { op: 'workout_summary' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [{ workout_id: 'w1' }]
    });
  });
});
