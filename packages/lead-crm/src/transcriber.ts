import OpenAI, { toFile } from 'openai';
import { z } from 'zod';

export const DEFAULT_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

export type Transcriber = (voice: Uint8Array) => Promise<string>;

export interface TranscriberOptions {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
}

const transcriptionSchema = z.object({ text: z.string() });

export function createTranscriber({
  apiKey,
  model = DEFAULT_TRANSCRIBE_MODEL,
  fetch,
}: TranscriberOptions): Transcriber {
  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1, fetch });

  return async (voice) => {
    const transcription = await client.audio.transcriptions.create({
      file: await toFile(voice, 'voice.ogg', { type: 'audio/ogg' }),
      model,
    });
    return transcriptionSchema.parse(transcription).text.trim();
  };
}
