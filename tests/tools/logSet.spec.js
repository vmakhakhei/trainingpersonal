import { describe, expect, it, vi } from 'vitest';
import { executeTool } from '../../api/_lib/toolExecutor.js';
import { logSet } from '../../src/server/tools/logSet.js';

function createLogSetSupabaseMock({ previousSetOrder = 2 } = {}) {
  let capturedInsertPayload = null;

  const workoutsChain = {
    select: vi.fn(() => workoutsChain),
    eq: vi.fn(() => workoutsChain),
    single: vi.fn(async () => ({ data: { id: 'workout-1' }, error: null }))
  };

  const setsSelectChain = {
    eq: vi.fn(() => setsSelectChain),
    order: vi.fn(() => setsSelectChain),
    limit: vi.fn(async () => ({
      data: previousSetOrder ? [{ set_order: previousSetOrder }] : [],
      error: null
    }))
  };

  const insertSingle = vi.fn(async () => ({
    data: {
      id: 'set-1',
      set_order: (previousSetOrder || 0) + 1
    },
    error: null
  }));

  const setsInsertChain = {
    select: vi.fn(() => ({ single: insertSingle }))
  };

  const setsModel = {
    select: vi.fn(() => setsSelectChain),
    insert: vi.fn((payload) => {
      capturedInsertPayload = payload;
      return setsInsertChain;
    })
  };

  const supabaseAdmin = {
    from: vi.fn((table) => {
      if (table === 'workouts') return workoutsChain;
      if (table === 'sets') return setsModel;
      throw new Error(`Unexpected table: ${table}`);
    })
  };

  return {
    supabaseAdmin,
    getInsertPayload: () => capturedInsertPayload
  };
}

describe('logSet tool', () => {
  it('computes set_order on the server and inserts a set', async () => {
    const { supabaseAdmin, getInsertPayload } = createLogSetSupabaseMock({ previousSetOrder: 3 });

    const result = await logSet({
      supabaseAdmin,
      userId: '123e4567-e89b-42d3-a456-426614174000',
      args: {
        workout_id: '123e4567-e89b-42d3-a456-426614174010',
        exercise_id: '123e4567-e89b-42d3-a456-426614174011',
        weight_kg: 100,
        reps: 5,
        rpe: 8
      }
    });

    expect(result.set_order).toBe(4);
    expect(getInsertPayload()).toMatchObject({
      set_order: 4,
      weight_kg: 100,
      reps: 5,
      rpe: 8
    });
  });

  it('enforces logSet validation through toolExecutor', async () => {
    await expect(
      executeTool({
        tool: 'logSet',
        args: {
          workout_id: '123e4567-e89b-42d3-a456-426614174010',
          exercise_id: '123e4567-e89b-42d3-a456-426614174011',
          weight_kg: 10,
          reps: 0
        },
        userId: '123e4567-e89b-42d3-a456-426614174000',
        supabaseClient: { from: vi.fn() }
      })
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENTS',
      statusCode: 400
    });
  });
});
