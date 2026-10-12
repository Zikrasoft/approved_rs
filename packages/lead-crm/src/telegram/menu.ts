import { isClosed, type StoredLead } from '../schema.ts';
import { MAX_LIST_ROWS } from '../store.ts';
import {
  leadDisplayName,
  STATUS_META,
  type Btn,
  type Keyboard,
  type Role,
} from './markup.ts';
import { balanceLine, LEDGER_ROW } from './ledger.ts';

export function buildOpenList(leads: StoredLead[]): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = leads
    .filter((l) => !isClosed(l))
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_LIST_ROWS)
    .map((l) => [
      {
        text: `#${l.id} ${leadDisplayName(l)} · ${l.brand} · ${STATUS_META[l.status].emoji}`,
        callback_data: `open:${l.id}`,
      },
    ]);
  return {
    text: rows.length ? 'Выберите заявку:' : 'Открытых заявок нет.',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildMenu(
  role: Role,
  balance: number | undefined,
): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = [
    ...(balance === undefined ? [] : [LEDGER_ROW]),
    [{ text: '📂 Открытые', callback_data: 'menu:open' }],
  ];
  if (role === 'admin')
    rows.push([{ text: '📊 Статистика', callback_data: 'menu:stats' }]);
  return {
    text: `${balanceLine(role, balance)}\n\n📋 Чтобы найти заявку, пришли имя, телефон или #номер — найдёт и отказы.`,
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildSearchResults(leads: StoredLead[]): {
  text: string;
  reply_markup: Keyboard;
} {
  if (leads.length === 0)
    return {
      text: 'Ничего не найдено.',
      reply_markup: { inline_keyboard: [] },
    };
  const rows: Btn[][] = leads.slice(0, MAX_LIST_ROWS).map((l) => {
    const label = `${STATUS_META[l.status].emoji} #${l.id} ${l.brand} ${leadDisplayName(l)} — ${l.contact}`;
    return [{ text: label, callback_data: `open:${l.id}` }];
  });
  return { text: 'Найдено:', reply_markup: { inline_keyboard: rows } };
}

export function buildHelp(role: Role): string {
  if (role === 'owner') {
    return [
      '<b>❓ Как пользоваться</b>',
      '',
      '<b>Карточка в группе</b>',
      '✅ Сделка, ❌ Отказ — итог заявки, она уходит из списков. ⏳ В работе — отметить, что занимаешься. 🗣 Переговоры — идёт разговор с клиентом; ставится и сама, когда пишешь посетителю в теме заявки.',
      'Ответь на карточку текстом — он сохранится заметкой в заявке.',
      '',
      '<b>Тема заявки</b>',
      'У заявки из бота своя тема в группе — 💬 Открыть тему. Всё, что пишешь в теме, — текст, фото, голосовые, файлы — бот перешлёт посетителю. Не доставилось — бот скажет об этом в теме.',
      '',
      '<b>В боте</b>',
      '📂 Открыть в боте — вся заявка: ⏰ Отложить до даты (в этот день вернётся в открытые).',
      '',
      '<b>Меню</b>',
      'Сверху — 💶 Мой долг. ➕ Зачислить — добавить, сколько должен; ➖ Списать — убрать, что уже отправил. Бот спросит сумму: ответь 40 или 40 Иван сервис. Ошибся — исправь обратной операцией.',
      '📂 Открытые. Найти заявку — пришли имя, телефон или номер (найдёт и отказы).',
    ].join('\n');
  }
  return [
    '<b>❓ Как пользоваться</b>',
    '',
    'Заявки ведёт владелец: ✅ Сделка, ❌ Отказ, ⏳ В работе, 🗣 Переговоры на карточке в группе.',
    '',
    '<b>Меню</b>',
    'Сверху — 💶 Мне должны. ➖ Списать — когда деньги пришли, ➕ Зачислить — если владелец что-то забыл. Бот спросит сумму: ответь 40 или 40 перевод. О каждой операции владельца тебе придёт уведомление.',
    '📂 Открытые, 📊 Статистика. Найти заявку — пришли имя, телефон или номер (найдёт и отказы).',
    '',
    '<b>Удаление</b>',
    '❌ Удалить навсегда — только у тебя. Спросит подтверждение и стирает заявку без возврата.',
  ].join('\n');
}
