import { clientKey, limit } from './rate-limit';

export const MAX_COMPLETIONS_PER_IP = 5;

export const limitCartCompletions = limit(
  (req) => [[clientKey(req, 'complete'), MAX_COMPLETIONS_PER_IP]],
  'Слишком много попыток оформить заказ. Попробуйте через минуту.',
);
