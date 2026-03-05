// file: CHECKLIST_SECURITY.md
# 🔒 Security Checklist — GymTracker PWA

## Источник требований
- research_payload.json (architecture, rag_policy)
- Security best practices для single-user PWA

---

## 🔑 Secrets Management

### Environment Variables

**НИКОГДА не коммитить:**
- ❌ `.env` файл
- ❌ API keys в коде
- ❌ Service Role Key в клиенте

**Правильное хранение:**
- ✅ `.env.example` с placeholders
- ✅ Секреты в Vercel Environment Variables
- ✅ Service Role Key ТОЛЬКО в serverless functions
- ✅ Anon Key в клиенте (публичный)

### Checklist
- [ ] `.env` добавлен в `.gitignore`
- [ ] Все секреты используют `process.env` или `import.meta.env`
- [ ] Service Role Key НЕ экспонирован через API
- [ ] DeepSeek API Key ТОЛЬКО на сервере

---

## 🛡️ Content Security Policy (CSP)

### Настроенный CSP (index.html)
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self'; 
  connect-src 'self' https://*.supabase.co https://*.vercel.app; 
  img-src 'self' data: blob: https://*.supabase.co; 
  style-src 'self' 'unsafe-inline'; 
  script-src 'self' 'unsafe-inline' 'unsafe-eval'; 
  worker-src 'self' blob:;
">
```

### Checklist
- [ ] CSP заголовок присутствует
- [ ] Только trusted domains в connect-src
- [ ] `'unsafe-eval'` минимизирован (для Vite dev mode)
- [ ] В production рассмотреть удаление `'unsafe-inline'`

---

## 🔐 Row Level Security (RLS)

### Single-User Policies (источник: meta.scope - single-user app)

**Критически важно:**
- ✅ RLS ВКЛЮЧЕН на всех user-owned таблицах
- ✅ Политики используют конкретный UUID (не auth.uid() для single-user)
- ✅ `YOUR_SUPABASE_USER_ID` заменен на реальный

### Checklist
- [ ] `profiles` - RLS enabled + single_user policy
- [ ] `approaches` - RLS enabled + single_user policy
- [ ] `instructions` - RLS enabled + single_user policy
- [ ] `workout_plans` - RLS enabled + single_user policy
- [ ] `workouts` - RLS enabled + single_user policy
- [ ] `sets` - RLS enabled + через workouts policy
- [ ] `weight_logs` - RLS enabled + single_user policy
- [ ] `progress_photos` - RLS enabled + single_user policy
- [ ] `exercises` - RLS enabled, SELECT для всех
- [ ] Протестировать: другой пользователь НЕ видит данные

---

## 🖼️ Storage Security (Signed URLs)

### Источник: architecture.storage - Supabase Storage (signed URLs)

**Правильная реализация:**
```javascript
// ❌ НЕПРАВИЛЬНО: публичный URL
const publicUrl = supabase.storage.from('progress-photos').getPublicUrl(path);

// ✅ ПРАВИЛЬНО: signed URL
const { data } = await supabase.storage
  .from('progress-photos')
  .createSignedUrl(path, 3600); // 1 hour expiry
```

### Checklist
- [ ] Bucket `progress-photos` создан с `public = false`
- [ ] Storage policies ограничивают доступ по user_id
- [ ] Все file URLs генерируются через `createSignedUrl()`
- [ ] Expiry time установлен (рекомендуется 1-24 часа)
- [ ] Клиент НЕ имеет прямого доступа к путям в Storage

---

## ✅ Input Validation

### Server-Side (API endpoints)

**Источник требований**: CONSTRAINTS - reps>=1, weight>=0
```javascript
// Всегда валидировать на сервере:
validatePositive('weight_kg', weight_kg);  // ≥ 0
if (reps < 1) throw new Error('reps must be >= 1');
if (rpe && (rpe < 1 || rpe > 10)) throw new Error('RPE 1-10');
```

### Checklist
- [ ] `weight_kg` ≥ 0 (CHECK constraint в SQL + server validation)
- [ ] `reps` ≥ 1 (CHECK constraint в SQL + server validation)
- [ ] `RPE` 1-10 или NULL
- [ ] `mood`, `energy_level` 1-5 или NULL
- [ ] Email format validation
- [ ] UUID format validation для ID параметров
- [ ] SQL injection защита (используя prepared statements)

---

## 🚦 Rate Limiting

### AI Proxy Rate Limiting

**Источник**: {"note":"Не подтверждено","verification":"low"} - конкретные лимиты не указаны в research_payload

**Текущая реализация**: 60 requests/hour через `ai_requests` таблицу

**Production upgrade**: Заменить на Vercel KV или Redis
```javascript
// Текущая (базовая):
const oneHourAgo = new Date(Date.now() - 3600000);
const { count } = await supabaseAdmin
  .from('ai_requests')
  .select('id', { count: 'exact' })
  .eq('user_id', userId)
  .gte('created_at', oneHourAgo);

if (count >= RATE_LIMIT_PER_HOUR) {
  throw new Error('Rate limit exceeded');
}
```

### Checklist
- [ ] Rate limit активен для `/api/ai/proxy`
- [ ] Requests логируются в `ai_requests`
- [ ] 429 код возвращается при превышении
- [ ] Для production: рассмотреть Vercel KV/Redis

---

## 🗄️ Data Protection

### Soft Delete & Retention (источник: требования soft-delete)

**Retention Policy**: 30 дней по умолчанию
```sql
-- Еженедельная очистка:
SELECT * FROM cleanup_soft_deletes(30);
```

### Checklist
- [ ] Все DELETE операции используют soft_delete()
- [ ] `is_deleted`, `deleted_at`, `deleted_by` установлены
- [ ] Restore функция работает
- [ ] Scheduled job для cleanup настроен
- [ ] Backup перед постоянным удалением

### GDPR/Data Export
```javascript
// Export пользовательских данных:
const userData = {
  profile: await supabase.from('profiles').select('*'),
  workouts: await supabase.from('workouts').select('*'),
  sets: await supabase.from('sets').select('*'),
  photos: await supabase.storage.from('progress-photos').list()
};
// Вернуть JSON
```

### Checklist
- [ ] Endpoint для экспорта данных реализован
- [ ] Endpoint для полного удаления аккаунта
- [ ] Backup strategy документирована

---

## 🔍 Audit & Monitoring

### Audit Log (источник: требования versioning/audit)

**Все изменения логируются:**
- INSERT, UPDATE, DELETE на критических таблицах
- Old/New data в JSONB
- User ID, timestamp, table name

### Checklist
- [ ] Audit triggers активны
- [ ] `audit_log` содержит записи
- [ ] Version numbers инкрементируются
- [ ] Rollback тестирован

### Monitoring

**Что отслеживать:**
- API error rates (Vercel logs)
- AI proxy usage (ai_requests таблица)
- Storage usage (Supabase dashboard)
- Failed login attempts
- Unusual data access patterns

### Checklist
- [ ] Vercel logs мониторятся
- [ ] Supabase logs мониторятся
- [ ] Alerts настроены для критических ошибок
- [ ] Weekly review процесс

---

## 🧪 Security Testing

### Manual Tests

1. **Authentication Bypass**
   - [ ] Попытка доступа без токена → 401
   - [ ] Попытка доступа с невалидным токеном → 401

2. **RLS Bypass**
   - [ ] Создать второго пользователя
   - [ ] Попытка получить workouts первого → Empty array

3. **SQL Injection**
   - [ ] Попытка инъекции через ID параметры
   - [ ] Попытка инъекции через text fields

4. **XSS**
   - [ ] Вставить `<script>alert('XSS')</script>` в notes
   - [ ] Убедиться что escape работает

5. **CSRF**
   - [ ] POST запрос с другого origin → CORS блокирует

### Automated (production upgrade)
- [ ] Dependency vulnerability scanning (npm audit)
- [ ] OWASP ZAP scan
- [ ] SSL/TLS проверка

---

## 📋 Incident Response Plan

### При обнаружении уязвимости:

1. **Оценка severity** (Critical/High/Medium/Low)
2. **Немедленные действия**:
   - Critical: Откат деплоя, отключить функционал
   - High: Hotfix в течение 24ч
   - Medium: Исправление в следующем релизе
3. **Уведомление**: Пользователь (single-user), stakeholders
4. **Патч и тестирование**
5. **Post-mortem**: Документировать и обновить checklist

---

**Последнее обновление**: 2024-03-04  
**Источник**: research_payload.json + security best practices