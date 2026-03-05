# 🏋️ GymTracker PWA

Приложение для отслеживания силовых тренировок с AI-помощником.

## Источники дизайна

Проект основан на анализе лучших практик конкурентов (источник: research_payload.json):

- **Fitbod**: AI-генерация тренировок, большая библиотека упражнений, офлайн-режим
- **Strong**: Быстрое логирование, RPE tracking, rich analytics
- **Hevy**: Безлимитный лог подходов, калькулятор тарелок, графики прогресса
- **JEFIT**: 1300+ упражнений, детальная статистика
- **GymBook**: Локальное хранение, приватность, офлайн-доступ

## Технологии

- **Frontend**: React 18 + Vite + Tailwind CSS (источник: architecture.frontend)
- **Backend**: Supabase (Auth + Postgres + Storage) (источник: architecture.backend)
- **AI**: DeepSeek через Vercel serverless proxy (источник: architecture.ai_proxy)
- **PWA**: Workbox, Service Worker, offline support

## Ключевые функции

### Источник: core_features

1. **Log Workout** (log_workout)
   - Быстрое логирование подходов
   - Упражнение, вес, повторения, RPE, заметки
   - ≤3 клика для добавления подхода (источник: ux_guidelines.notes)

2. **Exercise Library** (exercise_library)
   - Каталог упражнений с фильтрами
   - Видео-демонстрации
   - Группы мышц, оборудование

3. **Workout Plans** (workout_plan)
   - Создание шаблонов тренировок
   - Планы/рутины

4. **Progress Tracking** (progress_tracking)
   - Графики прогресса
   - 1RM calculator
   - Volume tracking

5. **AI Workout Generation** (ai_workout_generation - PRO)
   - AI-планировщик тренировок
   - Персонализация под цели

## UX Guidelines (источник: ux_guidelines)

- ✅ Touch targets ≥ 44px
- ✅ Font size ≥ 16sp
- ✅ Dark theme по умолчанию
- ✅ Timezone: Europe/Warsaw
- ✅ Минимизация кликов (≤3 для основных действий)
- ✅ Показ предыдущих результатов при вводе
- ✅ Inline-редактирование
- ✅ Быстрый свайп для удаления/редактирования

## Быстрый старт
```bash
# Установка
npm install

# Настройка
cp .env.example .env
# Отредактируйте .env

# Запуск
npm run dev

# Сборка
npm run build
```

## Документация

- [Deploy.md](Deploy.md) - Полная инструкция по деплою
- [CHECKLIST_RELEASE.md](CHECKLIST_RELEASE.md) - Release checklist
- [CHECKLIST_SECURITY.md](CHECKLIST_SECURITY.md) - Security checklist

## Архитектура
```
gymtracker-pwa/
├── src/
│   ├── pages/           # React страницы
│   ├── components/      # Переиспользуемые компоненты
│   ├── lib/             # Утилиты (supabase, constants)
│   └── store/           # Zustand state management
├── api/                 # Vercel serverless functions
│   ├── workouts/
│   ├── sets/
│   ├── approaches/
│   ├── instructions/
│   └── ai/              # AI proxy
├── supabase/            # Database schema
└── public/              # Static assets
```

## Security (источник: требования)

- ✅ Row Level Security (RLS) для single-user
- ✅ Signed URLs для Storage
- ✅ CSP headers
- ✅ Server-side validation (reps≥1, weight≥0)
- ✅ Rate limiting для AI proxy
- ✅ Soft-delete с retention (30 дней)
- ✅ Audit logging и versioning

## AI Features (источник: rag_policy)

- **Cache TTL**: 72 hours
- **Citation Required**: true
- **Output Format**: {answer, sources:[{id,excerpt,url}], confidence}
- **Fallback**: {"note":"Не подтверждено","verification":"low"} если нет источников

## Лицензия

MIT

---

**Версия**: 1.0.0  
**Дата**: 2024-03-04  
**Источник требований**: research_payload.json