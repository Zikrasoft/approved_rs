export const SERVICES: { slug: string; label: string }[] = [
  { slug: 'autopodbor', label: 'Автоподбор' },
  { slug: 'dostavka',   label: 'Доставка'   },
  { slug: 'vykup',      label: 'Выкуп'      },
  { slug: 'proverka',   label: 'Проверка'   },
  { slug: 'combined',   label: 'Под ключ'   },
];

// Keyed by form/Telegram service value
export const SERVICE_LABELS: Record<string, string> = {
  autopodbor: 'Автоподбор',
  delivery:   'Доставка',
  combined:   'Подбор + доставка',
  buyout:     'Выкуп',
  inspection: 'Проверка',
};

export const STATUS_LABELS: Record<string, string> = {
  in_progress: '✅ В работу',
  closed:      '❌ Закрыт',
  spam:        '🚫 Спам',
};

// Maps Telegram callback_query action → lead status in DB
export const ACTION_TO_STATUS: Record<string, 'in_progress' | 'closed' | 'spam'> = {
  accept: 'in_progress',
  close:  'closed',
  spam:   'spam',
};
