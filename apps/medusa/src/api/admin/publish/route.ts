import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { parseEnv } from '../../../lib/env';
import {
  type BuildOutcome,
  dispatchTarget,
  requestBuild,
} from '../../../lib/rebuild';

const ANSWERS: Record<BuildOutcome, { status: number; message: string }> = {
  started: {
    status: 202,
    message:
      'Публикация запущена. Если в каталоге есть изменения, сайт обновится сам в течение нескольких минут.',
  },
  'not-configured': {
    status: 503,
    message:
      'Публикация не настроена: на сервере нет токена сборки. Напишите разработчику.',
  },
  unauthorised: {
    status: 502,
    message:
      'Токен публикации не принят, скорее всего истёк его срок. Напишите разработчику, магазин при этом работает как обычно.',
  },
  refused: {
    status: 502,
    message:
      'Не удалось запустить публикацию: сборка не ответила. Попробуйте ещё раз через минуту.',
  },
};

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const outcome = await requestBuild({
    target: dispatchTarget(parseEnv(process.env)),
    logger,
  });
  const answer = ANSWERS[outcome];

  logger.info(`Publish requested by the admin: ${outcome}`);
  res.status(answer.status).json({ outcome, message: answer.message });
}
