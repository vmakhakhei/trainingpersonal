// file: CHECKLIST_RELEASE.md
# ✅ Release Checklist — GymTracker PWA

## Pre-Deploy Checklist

### Database
- [ ] SQL schema применена без ошибок
- [ ] Initial data (exercises) загружена
- [ ] RLS policies активны на всех user-owned таблицах
- [ ] `YOUR_SUPABASE_USER_ID` заменен на реальный UUID
- [ ] Storage bucket `progress-photos` создан с private access
- [ ] Bucket policies настроены

### Backend (Vercel Serverless)
- [ ] Все API endpoints протестированы (200/201/400/404/500)
- [ ] Environment variables установлены в Vercel Dashboard
- [ ] `SUPABASE_SERVICE_ROLE_KEY` установлен (НЕ anon key)
- [ ] `DEEPSEEK_API_KEY` установлен и валиден
- [ ] Rate limiting работает (проверить ai_requests таблицу)
- [ ] AI cache работает (TTL 72h, проверить ai_cache таблицу)
- [ ] Server-side validation работает (reps≥1, weight≥0)

### Frontend
- [ ] `.env` содержит правильные значения (не placeholders)
- [ ] Build проходит без ошибок (`npm run build`)
- [ ] PWA manifest.json корректен
- [ ] Service Worker регистрируется
- [ ] Все страницы доступны и рендерятся
- [ ] Mobile-first UI работает на iPhone
- [ ] Touch targets ≥44px (источник: ux_guidelines.touch_target_px)
- [ ] Font size ≥16sp (источник: ux_guidelines.font_min_sp)
- [ ] Dark theme работает по умолчанию (источник: ux_guidelines.dark_theme_default)

### Security
- [ ] CSP заголовок настроен
- [ ] Нет hardcoded secrets в коде
- [ ] Signed URLs используются для Storage
- [ ] CORS настроен корректно
- [ ] Service Role Key НЕ экспонирован на клиенте

### Features Testing
- [ ] **Регистрация/Вход** работает
- [ ] **Log Workout**: создать тренировку
- [ ] **Add Set**: добавить подход с валидацией
- [ ] **Soft Delete**: удалить и проверить is_deleted=true
- [ ] **Restore**: восстановить удаленную запись
- [ ] **Audit Log**: проверить записи в audit_log
- [ ] **Progress Photos**: загрузить фото через signed URL
- [ ] **AI Proxy**: отправить запрос и получить ответ с sources
- [ ] **AI Cache**: второй запрос должен вернуть cached:true
- [ ] **RPE Tracking**: ввести RPE 1-10
- [ ] **Calculate Volume**: проверить total_volume_kg пересчитывается

### Data Integrity
- [ ] Триггер `calculate_workout_volume` работает на INSERT/UPDATE/DELETE
- [ ] Триггер `update_updated_at` работает
- [ ] Триггер `audit_trigger_func` логирует изменения
- [ ] Version numbers инкрементируются при UPDATE

### Performance
- [ ] API responses < 500ms (кроме AI)
- [ ] AI cache hit rate > 30%
- [ ] Images оптимизированы
- [ ] PWA работает offline (basic caching)

## Post-Deploy Monitoring

### First 24 Hours
- [ ] Проверить error logs в Vercel
- [ ] Проверить Supabase logs
- [ ] Проверить AI requests usage
- [ ] Проверить Storage usage

### Weekly Maintenance
- [ ] Запустить `cleanup_ai_cache()`
- [ ] Запустить `cleanup_soft_deletes(30)`
- [ ] Проверить disk usage
- [ ] Backup database (еженедельный export JSON)

## Rollback Plan

Если критические проблемы:

1. **Frontend**: Откатить на предыдущий Vercel deployment
```bash
vercel rollback
```

2. **Database**: Восстановить из backup
```sql
-- Restore from backup file
psql "connection-string" -f backup_YYYY-MM-DD.sql
```

3. **Environment Variables**: Проверить через Vercel Dashboard

---

**Источники требований**: 
- research_payload.json (meta, ux_guidelines, core_features, architecture, rag_policy)
- Soft-delete/restore, versioning/audit, calculate_workout_volume, RLS, signed URLs, CSP