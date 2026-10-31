import type { MedusaContainer } from '@medusajs/framework/types';

import { parseEnv } from '../env';
import { SHOP_AI_REGISTRATION, type ShopAi } from './contract';
import { openAiShopAi } from './openai';

export * from './contract';

export const shopAi = (scope: MedusaContainer): ShopAi =>
  scope.hasRegistration(SHOP_AI_REGISTRATION)
    ? scope.resolve<ShopAi>(SHOP_AI_REGISTRATION)
    : openAiFromEnv();

const openAiFromEnv = () => {
  const env = parseEnv(process.env);
  return openAiShopAi(env.OPENAI_API_KEY, env.OPENAI_IMPORT_MODEL);
};
