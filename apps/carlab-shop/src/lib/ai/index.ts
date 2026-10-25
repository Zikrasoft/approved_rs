import type { MedusaContainer } from '@medusajs/framework/types';

import { parseEnv } from '../env';
import { SHOP_AI_REGISTRATION, type ShopAi } from './contract';
import { openAiShopAi } from './openai';

export * from './contract';

export const shopAi = (scope: MedusaContainer): ShopAi =>
  scope.hasRegistration(SHOP_AI_REGISTRATION)
    ? scope.resolve<ShopAi>(SHOP_AI_REGISTRATION)
    : openAiShopAi(parseEnv(process.env).OPENAI_API_KEY);
