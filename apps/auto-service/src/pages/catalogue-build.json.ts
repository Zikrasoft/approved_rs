import type { APIRoute } from 'astro';
import { partPagesForBuild } from '@/utils/catalogueEnv';

export const GET: APIRoute = async () =>
  Response.json({ partPages: (await partPagesForBuild()).length });
