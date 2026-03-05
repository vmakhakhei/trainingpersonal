// file: FINAL_DEPLOY_STEPS.md
# 🚀 GymTracker PWA — Финальные шаги деплоя

## Быстрый старт (5 минут)

### 1. Установка зависимостей
```bash
cd gymtracker-pwa
npm install
```

### 2. Настройка окружения
```bash
cp .env.example .env
```

Отредактируйте `.env` и заполните:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SINGLE_USER_ID` (после регистрации)

### 3. Импорт SQL схемы

**Вариант A: Supabase Dashboard**
1. SQL Editor → New Query
2. Вставьте содержимое `supabase/schema.sql`
3. Run

**Вариант B: CLI**
```bash
supabase db push
```

### 4. Регистрация и замена USER_ID

1. Запустите локально: `npm run dev`
2. Зарегистрируйтесь в приложении
3. Скопируйте UUID из Supabase Dashboard
4. Замените `YOUR_SUPABASE_USER_ID` в:
   - `.env` → `VITE_SINGLE_USER_ID`
   - SQL RLS policies (пересоздайте с правильным UUID)

### 5. Создать Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false);
```

### 6. Деплой на Vercel
```bash
vercel

# Добавьте environment variables:
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_SINGLE_USER_ID
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add DEEPSEEK_API_KEY

# Production deploy:
vercel --prod
```

## Проверка

### Тест API endpoints
```bash
# Workouts
curl https://your-app.vercel.app/api/workouts

# AI Proxy
curl -X POST https://your-app.vercel.app/api/ai/proxy \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Как делать приседания?"}'
```

### Ручные тесты

✓ Регистрация/вход  
✓ Создать тренировку  
✓ Добавить подход  
✓ Просмотреть аналитику  
✓ AI запрос  
✓ Soft delete + restore  

## Troubleshooting

**Проблема**: RLS блокирует доступ  
**Решение**: Проверьте что UUID в RLS совпадает с реальным

**Проблема**: AI proxy 500  
**Решение**: Проверьте `DEEPSEEK_API_KEY` в Vercel

**Проблема**: Build fails  
**Решение**: `npm install` и проверьте версии Node.js ≥18

## Документация

- [Deploy.md](Deploy.md) - Полная инструкция
- [CHECKLIST_RELEASE.md](CHECKLIST_RELEASE.md) - Release checklist
- [CHECKLIST_SECURITY.md](CHECKLIST_SECURITY.md) - Security checklist

---

**Источник требований**: research_payload.json