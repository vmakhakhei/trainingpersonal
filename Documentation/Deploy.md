// file: Deploy.md
# 🚀 GymTracker PWA — Инструкция по деплою

## Источники дизайна
- **Architecture**: React (Vite) + Tailwind, Supabase, Vercel (источник: research_payload.architecture)
- **UX Guidelines**: Touch targets ≥44px, Font ≥16sp, Dark theme, Europe/Warsaw (источник: research_payload.ux_guidelines)

---

## 📋 Предварительные требования

1. **Node.js** ≥ 18.0.0
2. **npm** или **yarn**
3. **Supabase Account** (https://supabase.com)
4. **Vercel Account** (https://vercel.com)
5. **DeepSeek API Key** (https://platform.deepseek.com)

---

## 🔧 Локальная установка

### 1. Клонировать/Распаковать проект
```bash
# Распаковать gymtracker.zip
unzip gymtracker.zip
cd gymtracker-pwa
```

### 2. Установить зависимости
```bash
npm install
```

### 3. Настроить окружение

Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_SINGLE_USER_ID=YOUR_SUPABASE_USER_ID  # Установите ПОСЛЕ регистрации
VITE_AI_PROXY_URL=http://localhost:3000/api/ai/proxy  # Для локальной разработки
```

### 4. Запустить локально
```bash
npm run dev
```

Приложение откроется на `http://localhost:3000`

---

## 🗄️ Настройка Supabase

### 1. Создать проект Supabase

1. Перейдите на https://supabase.com/dashboard
2. Создайте новый проект
3. Скопируйте URL проекта и anon key в `.env`

### 2. Импортировать SQL схему

**Вариант A: Через Supabase Dashboard**

1. Откройте SQL Editor в Supabase Dashboard
2. Создайте новый query
3. Вставьте содержимое `supabase/schema.sql`
4. Выполните (Run)

**Вариант B: Через Supabase CLI**
```bash
# Установить Supabase CLI
npm install -g supabase

# Войти в аккаунт
supabase login

# Связать с проектом
supabase link --project-ref your-project-ref

# Применить миграцию
supabase db push
```

**Вариант C: Через psql**
```bash
psql "postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/schema.sql
```

### 3. Создать Storage Bucket
```sql
-- В SQL Editor выполните:
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false);

-- Настроить RLS для bucket
CREATE POLICY "User can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = 'YOUR_SUPABASE_USER_ID');

CREATE POLICY "User can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'progress-photos' AND auth.uid()::text = 'YOUR_SUPABASE_USER_ID');
```

### 4. Зарегистрировать пользователя

1. Запустите приложение локально
2. Зарегистрируйтесь через интерфейс
3. Проверьте email и подтвердите регистрацию
4. Скопируйте UUID пользователя:
```sql
-- В SQL Editor:
SELECT id, email FROM auth.users;
```

5. Замените `YOUR_SUPABASE_USER_ID` в `.env` и в SQL:
```sql
-- Обновите RLS policies:
UPDATE pg_policies
SET qual = replace(qual::text, 'YOUR_SUPABASE_USER_ID', 'ваш-реальный-uuid')::pg_node_tree
WHERE policyname LIKE '%single_user%';

-- Или пересоздайте policies вручную с правильным UUID
```

---

## ☁️ Деплой на Vercel

### 1. Подготовка
```bash
# Установить Vercel CLI
npm install -g vercel
```

### 2. Деплой frontend + API
```bash
# Войти в Vercel
vercel login

# Деплой (первый раз)
vercel

# Следуйте инструкциям:
# - Link to existing project? No
# - Project name: gymtracker-pwa
# - Directory: ./
# - Override settings? No
```

### 3. Настроить Environment Variables в Vercel

**Через Vercel Dashboard:**

1. Откройте ваш проект
2. Settings → Environment Variables
3. Добавьте:
```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = your_anon_key
VITE_SINGLE_USER_ID = ваш-реальный-uuid
VITE_AI_PROXY_URL = https://your-app.vercel.app/api/ai/proxy

# Serverless API Variables:
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
DEEPSEEK_API_KEY = your_deepseek_api_key
DEEPSEEK_API_URL = https://api.deepseek.com/v1/chat/completions
RATE_LIMIT_PER_HOUR = 60
CACHE_TTL_HOURS = 72
```

**Через CLI:**
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_SINGLE_USER_ID
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DEEPSEEK_API_KEY
vercel env add RATE_LIMIT_PER_HOUR
vercel env add CACHE_TTL_HOURS
```

### 4. Повторный деплой
```bash
vercel --prod
```

---

## 📱 PWA на iOS (Add to Home Screen)

### Инструкция для пользователя:

1. Откройте приложение в Safari
2. Нажмите кнопку "Поделиться" (квадрат со стрелкой)
3. Выберите "На экран «Домой»"
4. Нажмите "Добавить"

Приложение будет работать как нативное с иконкой на главном экране.

---

## 🧪 Проверка деплоя (Manual Tests)

### 1. Проверить API Endpoints
```bash
# Создать workout
curl -X POST https://your-app.vercel.app/api/workouts \
  -H "Content-Type: application/json" \
  -d '{"workout_date":"2024-03-04","notes":"Test workout"}'

# Получить workouts
curl https://your-app.vercel.app/api/workouts

# Создать set
curl -X POST https://your-app.vercel.app/api/sets \
  -H "Content-Type: application/json" \
  -d '{
    "workout_id":"uuid-here",
    "exercise_id":"uuid-here",
    "set_order":1,
    "weight_kg":100,
    "reps":10
  }'

# AI запрос
curl -X POST https://your-app.vercel.app/api/ai/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"Как правильно делать приседания?",
    "context":{}
  }'

# AI tools layer (MVP)
curl -X POST https://your-app.vercel.app/api/tools \
  -H "Content-Type: application/json" \
  -d '{
    "tool":"getWorkoutHistory",
    "arguments":{"limit":10}
  }'

# Analytics reads (materialized views)
curl "https://your-app.vercel.app/api/analytics?op=workout_summary&limit=3"
curl "https://your-app.vercel.app/api/analytics?op=exercise_progress&exercise_id=<uuid>&limit=5"
curl "https://your-app.vercel.app/api/analytics?op=muscle_volume&from=2026-03-01&to=2026-03-31&muscle=chest"

# Analytics refresh (protected)
curl -X POST "https://your-app.vercel.app/api/analytics?op=refresh" \
  -H "x-service-role: $SUPABASE_SERVICE_ROLE_KEY"
```

### 2. Проверить RLS
```sql
-- От имени пользователя:
SELECT * FROM workouts;  -- Должны видеть только свои записи
SELECT * FROM exercises; -- Должны видеть все
```

### 3. Проверить Soft Delete & Restore
```sql
-- Soft delete
SELECT soft_delete('workouts', 'workout-uuid');

-- Проверить
SELECT * FROM workouts WHERE is_deleted = true;

-- Restore
SELECT restore_record('workouts', 'workout-uuid');
```

### 4. Проверить Audit Log
```sql
SELECT * FROM audit_log 
WHERE table_name = 'workouts' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🔒 Security Checklist

✅ CSP настроен в index.html  
✅ Service Role Key только на сервере (не в клиенте)  
✅ RLS включен на всех user-owned таблицах  
✅ Signed URLs для Storage  
✅ Server-side validation (reps≥1, weight≥0)  
✅ Rate limiting для AI proxy  

---

## 📊 Monitoring & Maintenance

### Analytics: how to schedule refresh

Используйте внешний cron/scheduler (например GitHub Actions) и вызывайте refresh endpoint с секретным заголовком:

```bash
curl -X POST "https://your-app.vercel.app/api/analytics?op=refresh" \
  -H "x-service-role: $SUPABASE_SERVICE_ROLE_KEY"
```

Рекомендуемая частота: раз в 6 часов (`0 */6 * * *`).
Если `REFRESH CONCURRENTLY` недоступен, функция автоматически использует обычный `REFRESH` и пишет результат в `analytics_refresh_log`.

### Очистка expired cache (запускать еженедельно)
```sql
SELECT cleanup_ai_cache();
```

### Очистка soft-deleted records (retention 30 дней)
```sql
SELECT * FROM cleanup_soft_deletes(30);
```

### Проверка disk usage
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🆘 Troubleshooting

### Проблема: "VITE_SINGLE_USER_ID not configured"

**Решение**: Убедитесь что `.env` содержит правильный UUID пользователя, а не placeholder.

### Проблема: RLS блокирует доступ

**Решение**: Проверьте что UUID в RLS policies совпадает с реальным ID пользователя.

### Проблема: AI proxy возвращает 500

**Решение**: Проверьте что `DEEPSEEK_API_KEY` установлен в Vercel Environment Variables.

### Проблема: Images не загружаются

**Решение**: Проверьте bucket policies и используйте signed URLs:
```javascript
const { data } = await supabase.storage
  .from('progress-photos')
  .createSignedUrl(path, 3600); // 1 hour
```

---

## 📚 Дополнительная информация

- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **React Router**: https://reactrouter.com
- **Tailwind CSS**: https://tailwindcss.com

---

**Источник требований**: research_payload.json (fileciteturn0file0)
