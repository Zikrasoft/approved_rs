import type { APIRoute } from 'astro';
import { pageListForBuild } from '@/utils/catalogueEnv';

export const GET: APIRoute = async () =>
  Response.json({ partPages: (await pageListForBuild()).parts.length });
