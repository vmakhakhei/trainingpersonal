-- file: supabase/schema.sql
-- ============================================
-- GymTracker Single-User Database Schema
-- Version: 1.0.0
-- Timezone: Europe/Warsaw (источник: research_payload - ux_guidelines.timezone)
-- Single-user app (источник: research_payload - meta.scope)
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- для text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- для encryption

-- ============================================
-- USER PROFILES
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'Europe/Warsaw', -- источник: ux_guidelines.timezone
    units_system TEXT DEFAULT 'metric',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================
-- EXERCISES LIBRARY
-- Источник: competitors - Fitbod (большая библиотека), JEFIT (1300+ упражнений)
-- ============================================
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_ru TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    secondary_muscles TEXT[],
    equipment TEXT NOT NULL,
    difficulty TEXT DEFAULT 'intermediate',
    is_compound BOOLEAN DEFAULT false,
    description TEXT,
    description_ru TEXT,
    video_url TEXT,
    demo_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    CONSTRAINT valid_muscle CHECK (primary_muscle IN ('chest', 'back', 'legs', 'shoulders', 'arms', 'core')),
    CONSTRAINT valid_equipment CHECK (equipment IN ('barbell', 'dumbbell', 'cable', 'bodyweight', 'machine')),
    CONSTRAINT valid_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced'))
);

-- ============================================
-- INSTRUCTIONS (инструкции к упражнениям)
-- ============================================
CREATE TABLE instructions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    instruction_type TEXT DEFAULT 'technique',
    media_urls TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    CONSTRAINT valid_instruction_type CHECK (instruction_type IN ('technique', 'safety', 'progression', 'custom'))
);

-- ============================================
-- APPROACHES (методики тренировок)
-- ============================================
CREATE TABLE approaches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    approach_type TEXT DEFAULT 'periodization',
    parameters JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    CONSTRAINT valid_approach_type CHECK (approach_type IN ('periodization', 'pyramid', 'superset', 'dropset', 'rest-pause', 'custom'))
);

-- ============================================
-- WORKOUT PLANS
-- Источник: core_features.workout_plan
-- ============================================
CREATE TABLE workout_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    goal TEXT,
    days_per_week INTEGER CHECK (days_per_week BETWEEN 1 AND 7),
    duration_weeks INTEGER,
    approach_id UUID REFERENCES approaches(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::JSONB,
    
    CONSTRAINT valid_goal CHECK (goal IN ('strength', 'hypertrophy', 'endurance', 'general'))
);

-- ============================================
-- PLAN EXERCISES
-- ============================================
CREATE TABLE plan_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    day_number INTEGER NOT NULL CHECK (day_number >= 1),
    exercise_order INTEGER NOT NULL CHECK (exercise_order >= 1),
    target_sets INTEGER NOT NULL CHECK (target_sets > 0),
    target_reps_min INTEGER CHECK (target_reps_min > 0),
    target_reps_max INTEGER CHECK (target_reps_max >= target_reps_min),
    rest_seconds INTEGER DEFAULT 90, -- источник: ux_guidelines notes
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    UNIQUE(plan_id, day_number, exercise_order)
);

-- ============================================
-- WORKOUTS
-- Источник: core_features.log_workout
-- ============================================
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES workout_plans(id),
    workout_date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    total_volume_kg DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    mood INTEGER CHECK (mood BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- ============================================
-- SETS
-- Источник: competitors - Strong, Hevy (RPE, быстрое логирование)
-- ============================================
CREATE TABLE sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    set_order INTEGER NOT NULL CHECK (set_order >= 1),
    weight_kg DECIMAL(8,2) NOT NULL CHECK (weight_kg >= 0),
    reps INTEGER NOT NULL CHECK (reps >= 1),
    rpe DECIMAL(3,1) CHECK (rpe BETWEEN 1 AND 10), -- источник: Hevy, Strong - RPE tracking
    is_warmup BOOLEAN DEFAULT false,
    is_failure BOOLEAN DEFAULT false,
    rest_seconds INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    UNIQUE(workout_id, exercise_id, set_order)
);

-- ============================================
-- WEIGHT LOGS
-- Источник: core_features.progress_tracking
-- ============================================
CREATE TABLE weight_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0),
    body_fat_percentage DECIMAL(4,2) CHECK (body_fat_percentage BETWEEN 0 AND 100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    UNIQUE(user_id, log_date)
);

-- ============================================
-- PROGRESS PHOTOS
-- Источник: architecture.storage - Supabase Storage (signed URLs)
-- ============================================
CREATE TABLE progress_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    photo_date DATE NOT NULL,
    storage_path TEXT NOT NULL,
    photo_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version_number INTEGER DEFAULT 1,
    
    CONSTRAINT valid_photo_type CHECK (photo_type IN ('front', 'side', 'back', 'other'))
);

-- ============================================
-- AI CACHE
-- Источник: rag_policy.ttl_hours (72h), citation_required (true)
-- ============================================
CREATE TABLE ai_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key TEXT NOT NULL UNIQUE,
    prompt_hash TEXT NOT NULL,
    response_data JSONB NOT NULL,
    sources JSONB,
    confidence DECIMAL(3,2) CHECK (confidence BETWEEN 0 AND 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    hit_count INTEGER DEFAULT 0,
    
    CHECK (expires_at > created_at)
);

-- ============================================
-- AI REQUESTS LOG
-- Источник: ai_proxy requirements - logging
-- ============================================
CREATE TABLE ai_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    endpoint TEXT NOT NULL,
    prompt_text TEXT,
    response_text TEXT,
    status_code INTEGER,
    error_message TEXT,
    tokens_used INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG
-- Источник: требования - versioning & audit
-- ============================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'RESTORE'))
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_profiles_email ON profiles(email) WHERE NOT is_deleted;

CREATE INDEX idx_exercises_muscle ON exercises(primary_muscle) WHERE NOT is_deleted;
CREATE INDEX idx_exercises_equipment ON exercises(equipment) WHERE NOT is_deleted;
CREATE INDEX idx_exercises_search ON exercises USING gin(name_ru gin_trgm_ops) WHERE NOT is_deleted;
CREATE INDEX idx_exercises_compound ON exercises(is_compound) WHERE NOT is_deleted;

CREATE INDEX idx_instructions_exercise ON instructions(exercise_id) WHERE NOT is_deleted;
CREATE INDEX idx_instructions_user ON instructions(user_id) WHERE NOT is_deleted;

CREATE INDEX idx_approaches_user ON approaches(user_id) WHERE NOT is_deleted;
CREATE INDEX idx_approaches_type ON approaches(approach_type) WHERE NOT is_deleted;

CREATE INDEX idx_workout_plans_user ON workout_plans(user_id) WHERE NOT is_deleted;
CREATE INDEX idx_workout_plans_active ON workout_plans(user_id, is_active) WHERE NOT is_deleted;

CREATE INDEX idx_plan_exercises_plan ON plan_exercises(plan_id) WHERE NOT is_deleted;
CREATE INDEX idx_plan_exercises_exercise ON plan_exercises(exercise_id);

CREATE INDEX idx_workouts_user_date ON workouts(user_id, workout_date DESC) WHERE NOT is_deleted;
CREATE INDEX idx_workouts_plan ON workouts(plan_id) WHERE NOT is_deleted;
CREATE INDEX idx_workouts_date ON workouts(workout_date DESC) WHERE NOT is_deleted;

CREATE INDEX idx_sets_workout ON sets(workout_id) WHERE NOT is_deleted;
CREATE INDEX idx_sets_exercise ON sets(exercise_id) WHERE NOT is_deleted;
CREATE INDEX idx_sets_workout_exercise ON sets(workout_id, exercise_id);

CREATE INDEX idx_weight_logs_user_date ON weight_logs(user_id, log_date DESC) WHERE NOT is_deleted;

CREATE INDEX idx_progress_photos_user_date ON progress_photos(user_id, photo_date DESC) WHERE NOT is_deleted;

CREATE INDEX idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON ai_cache(expires_at);
CREATE INDEX idx_ai_cache_hash ON ai_cache(prompt_hash);

CREATE INDEX idx_ai_requests_user ON ai_requests(user_id);
CREATE INDEX idx_ai_requests_created ON ai_requests(created_at DESC);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_exercises_updated BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_instructions_updated BEFORE UPDATE ON instructions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_approaches_updated BEFORE UPDATE ON approaches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workout_plans_updated BEFORE UPDATE ON workout_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plan_exercises_updated BEFORE UPDATE ON plan_exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workouts_updated BEFORE UPDATE ON workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sets_updated BEFORE UPDATE ON sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_weight_logs_updated BEFORE UPDATE ON weight_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_progress_photos_updated BEFORE UPDATE ON progress_photos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit trigger
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Получаем user_id из настроек сессии или NULL
    BEGIN
        v_user_id := current_setting('app.current_user_id', TRUE)::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), v_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        NEW.version_number = COALESCE(OLD.version_number, 0) + 1;
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), v_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_log (table_name, record_id, action, new_data, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), v_user_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_profiles AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER trg_audit_approaches AFTER INSERT OR UPDATE OR DELETE ON approaches
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER trg_audit_workout_plans AFTER INSERT OR UPDATE OR DELETE ON workout_plans
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER trg_audit_workouts AFTER INSERT OR UPDATE OR DELETE ON workouts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER trg_audit_sets AFTER INSERT OR UPDATE OR DELETE ON sets
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Calculate workout volume (источник: Hevy - volume tracking)
CREATE OR REPLACE FUNCTION calculate_workout_volume()
RETURNS TRIGGER AS $$
DECLARE
    v_workout_id UUID;
    v_new_volume DECIMAL(10,2);
BEGIN
    -- Определяем workout_id
    IF TG_OP = 'DELETE' THEN
        v_workout_id := OLD.workout_id;
    ELSE
        v_workout_id := NEW.workout_id;
    END IF;

    -- Вычисляем новый объём
    SELECT COALESCE(SUM(weight_kg * reps), 0)
    INTO v_new_volume
    FROM sets
    WHERE workout_id = v_workout_id
      AND NOT is_deleted
      AND NOT is_warmup;

    -- Обновляем workout
    UPDATE workouts
    SET total_volume_kg = v_new_volume
    WHERE id = v_workout_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sets_volume_insert AFTER INSERT ON sets
    FOR EACH ROW EXECUTE FUNCTION calculate_workout_volume();
CREATE TRIGGER trg_sets_volume_update AFTER UPDATE ON sets
    FOR EACH ROW EXECUTE FUNCTION calculate_workout_volume();
CREATE TRIGGER trg_sets_volume_delete AFTER DELETE ON sets
    FOR EACH ROW EXECUTE FUNCTION calculate_workout_volume();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ВАЖНО: Замените 'YOUR_SUPABASE_USER_ID' на реальный UUID
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE approaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_single_user" ON profiles
    FOR ALL USING (id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Approaches
CREATE POLICY "approaches_single_user" ON approaches
    FOR ALL USING (user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Instructions
CREATE POLICY "instructions_single_user" ON instructions
    FOR ALL USING (user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Workout Plans
CREATE POLICY "workout_plans_single_user" ON workout_plans
    FOR ALL USING (user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Workouts
CREATE POLICY "workouts_single_user" ON workouts
    FOR ALL USING (user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Sets (доступ через workouts)
CREATE POLICY "sets_single_user" ON sets
    FOR ALL USING (
        workout_id IN (
            SELECT id FROM workouts WHERE user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID
        )
    );

-- Weight Logs
CREATE POLICY "weight_logs_single_user" ON weight_logs
    FOR ALL USING (user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Progress Photos
CREATE POLICY "progress_photos_single_user" ON progress_photos
    FOR ALL USING (user_id = '16a037ff-7a35-43a0-8522-1e64c6163abf'::UUID);

-- Exercises (публичные для чтения)
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises_readable" ON exercises
    FOR SELECT USING (NOT is_deleted);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Soft delete
CREATE OR REPLACE FUNCTION soft_delete(
    p_table TEXT,
    p_id UUID,
    p_deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET is_deleted = true, deleted_at = NOW(), deleted_by = $2 WHERE id = $1',
        p_table
    ) USING p_id, p_deleted_by;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore
CREATE OR REPLACE FUNCTION restore_record(
    p_table TEXT,
    p_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET is_deleted = false, deleted_at = NULL, deleted_by = NULL WHERE id = $1',
        p_table
    ) USING p_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup soft deletes (retention по умолчанию 30 дней)
CREATE OR REPLACE FUNCTION cleanup_soft_deletes(
    p_retention_days INTEGER DEFAULT 30
)
RETURNS TABLE(table_name TEXT, deleted_count INTEGER) AS $$
DECLARE
    v_table TEXT;
    v_count INTEGER;
BEGIN
    FOR v_table IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'approaches', 'instructions', 'workout_plans', 'plan_exercises',
            'workouts', 'sets', 'weight_logs', 'progress_photos'
        )
    LOOP
        EXECUTE format(
            'DELETE FROM %I WHERE is_deleted = true AND deleted_at < NOW() - INTERVAL ''%s days''',
            v_table,
            p_retention_days
        );
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        
        RETURN QUERY SELECT v_table, v_count;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate 1RM (Epley formula) - источник: competitors analytics
CREATE OR REPLACE FUNCTION calculate_1rm(
    p_weight DECIMAL,
    p_reps INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
    IF p_reps = 1 THEN
        RETURN p_weight;
    END IF;
    RETURN ROUND(p_weight * (1 + p_reps::DECIMAL / 30), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get exercise PRs
CREATE OR REPLACE FUNCTION get_exercise_prs(
    p_exercise_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    max_weight DECIMAL,
    max_volume DECIMAL,
    max_1rm DECIMAL,
    best_set_date DATE,
    total_sets INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        MAX(s.weight_kg) as max_weight,
        MAX(s.weight_kg * s.reps) as max_volume,
        MAX(calculate_1rm(s.weight_kg, s.reps)) as max_1rm,
        (SELECT w.workout_date 
         FROM workouts w 
         JOIN sets s2 ON s2.workout_id = w.id
         WHERE s2.exercise_id = p_exercise_id 
         AND NOT s2.is_deleted AND NOT s2.is_warmup
         ORDER BY calculate_1rm(s2.weight_kg, s2.reps) DESC 
         LIMIT 1) as best_set_date,
        COUNT(s.id)::INTEGER as total_sets
    FROM sets s
    JOIN workouts w ON w.id = s.workout_id
    WHERE s.exercise_id = p_exercise_id
      AND w.user_id = p_user_id
      AND NOT s.is_deleted
      AND NOT s.is_warmup
      AND NOT w.is_deleted;
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired AI cache (источник: rag_policy.ttl_hours = 72)
CREATE OR REPLACE FUNCTION cleanup_ai_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ai_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW recent_workouts_summary AS
SELECT
    w.id,
    w.user_id,
    w.workout_date,
    w.total_volume_kg,
    COUNT(DISTINCT s.exercise_id) as exercises_count,
    COUNT(s.id) as total_sets,
    SUM(s.reps) as total_reps,
    EXTRACT(EPOCH FROM (w.end_time - w.start_time))/60 as duration_minutes,
    w.mood,
    w.energy_level
FROM workouts w
LEFT JOIN sets s ON s.workout_id = w.id AND NOT s.is_deleted
WHERE NOT w.is_deleted
GROUP BY w.id, w.user_id, w.workout_date, w.total_volume_kg, w.start_time, w.end_time, w.mood, w.energy_level
ORDER BY w.workout_date DESC;

CREATE OR REPLACE VIEW exercise_progress AS
SELECT
    e.id as exercise_id,
    e.name_ru as exercise_name,
    s.weight_kg,
    s.reps,
    s.rpe,
    calculate_1rm(s.weight_kg, s.reps) as estimated_1rm,
    w.workout_date,
    w.user_id
FROM sets s
JOIN exercises e ON e.id = s.exercise_id
JOIN workouts w ON w.id = s.workout_id
WHERE NOT s.is_deleted
  AND NOT s.is_warmup
  AND NOT w.is_deleted
ORDER BY e.name_ru, w.workout_date DESC;

-- ============================================
-- INITIAL DATA
-- ============================================

INSERT INTO exercises (name, name_ru, primary_muscle, equipment, difficulty, is_compound, description_ru) VALUES
('Squat', 'Приседания со штангой', 'legs', 'barbell', 'intermediate', true, 'Базовое упражнение для ног'),
('Bench Press', 'Жим лёжа', 'chest', 'barbell', 'intermediate', true, 'Базовое упражнение для груди'),
('Deadlift', 'Становая тяга', 'back', 'barbell', 'advanced', true, 'Базовое упражнение для спины'),
('Overhead Press', 'Жим стоя', 'shoulders', 'barbell', 'intermediate', true, 'Базовое упражнение для плеч'),
('Pull-up', 'Подтягивания', 'back', 'bodyweight', 'intermediate', true, 'Упражнение для спины'),
('Barbell Row', 'Тяга штанги', 'back', 'barbell', 'intermediate', true, 'Базовое для спины'),
('Dumbbell Row', 'Тяга гантели', 'back', 'dumbbell', 'beginner', false, 'Изоляция спины'),
('Bicep Curl', 'Подъём на бицепс', 'arms', 'dumbbell', 'beginner', false, 'Изоляция бицепса'),
('Tricep Extension', 'Разгибание на трицепс', 'arms', 'cable', 'beginner', false, 'Изоляция трицепса'),
('Leg Press', 'Жим ногами', 'legs', 'machine', 'beginner', false, 'Упражнение для ног'),
('Plank', 'Планка', 'core', 'bodyweight', 'beginner', false, 'Статика для кора'),
('Russian Twist', 'Русские скручивания', 'core', 'bodyweight', 'beginner', false, 'Для косых мышц');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE exercises IS 'Источник: Fitbod (большая библиотека), JEFIT (1300+)';
COMMENT ON TABLE approaches IS 'Методики тренировок';
COMMENT ON TABLE instructions IS 'Инструкции к упражнениям';
COMMENT ON TABLE workout_plans IS 'Источник: Strong, Hevy - планы тренировок';
COMMENT ON TABLE sets IS 'Источник: Strong, Hevy - RPE tracking';
COMMENT ON TABLE ai_cache IS 'Кеш DeepSeek. TTL 24-72h (rag_policy)';
COMMENT ON TABLE audit_log IS 'Audit trail для версионирования';
COMMENT ON FUNCTION calculate_1rm(DECIMAL, INTEGER) IS 'Epley formula для 1RM';