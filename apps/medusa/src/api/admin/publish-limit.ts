import { clientKey, limit } from '../store/rate-limit';

export const MAX_PUBLISHES_PER_IP = 6;

export const limitPublishes = limit(
  (req) => [[clientKey(req, 'publish'), MAX_PUBLISHES_PER_IP]],
  'Публикация уже запущена. Подождите минуту, сайт обновится сам.',
);
