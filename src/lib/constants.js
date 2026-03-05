// file: src/lib/constants.js
// Источник: research_payload - ux_guidelines, core_features

// Источник: ux_guidelines.timezone
export const TIMEZONE = 'Europe/Warsaw';

// Источник: ux_guidelines
export const UI_CONSTANTS = {
  MIN_TOUCH_TARGET: 44, // touch_target_px
  MIN_FONT_SIZE: 16, // font_min_sp
  DEFAULT_REST_SECONDS: 90,
  MAX_CLICKS_FOR_SET: 3 // notes - минимизация кликов
};

// Источник: core_features.exercise_library.db_model
export const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Грудь' },
  { value: 'back', label: 'Спина' },
  { value: 'legs', label: 'Ноги' },
  { value: 'shoulders', label: 'Плечи' },
  { value: 'arms', label: 'Руки' },
  { value: 'core', label: 'Кор' }
];

export const EQUIPMENT_TYPES = [
  { value: 'barbell', label: 'Штанга' },
  { value: 'dumbbell', label: 'Гантели' },
  { value: 'cable', label: 'Тросы' },
  { value: 'machine', label: 'Тренажёр' },
  { value: 'bodyweight', label: 'Свой вес' }
];

export const DIFFICULTY_LEVELS = [
  { value: 'beginner', label: 'Начинающий' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced', label: 'Продвинутый' }
];

// Источник: competitors - Hevy, Strong (RPE tracking)
export const RPE_SCALE = Array.from({ length: 10 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1}`,
  description: i + 1 === 10 ? 'Максимум' : i + 1 >= 9 ? 'Очень тяжело' : i + 1 >= 7 ? 'Тяжело' : 'Средне'
}));

// {"note":"Не подтверждено","verification":"low"} - типы approach не указаны детально в research_payload
export const APPROACH_TYPES = [
  { value: 'periodization', label: 'Периодизация' },
  { value: 'pyramid', label: 'Пирамида' },
  { value: 'superset', label: 'Суперсет' },
  { value: 'dropset', label: 'Дропсет' },
  { value: 'rest-pause', label: 'Отдых-пауза' },
  { value: 'custom', label: 'Свой' }
];

// {"note":"Не подтверждено","verification":"low"} - типы instruction не указаны детально в research_payload
export const INSTRUCTION_TYPES = [
  { value: 'technique', label: 'Техника' },
  { value: 'safety', label: 'Безопасность' },
  { value: 'progression', label: 'Прогрессия' },
  { value: 'custom', label: 'Свой' }
];