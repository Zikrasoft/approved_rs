import { z } from 'zod';
import { PRIMARY_LOCALE, SUPPORTED_LOCALES } from './config';

export const localeFieldSchema = z
  .enum(SUPPORTED_LOCALES)
  .catch(PRIMARY_LOCALE);
