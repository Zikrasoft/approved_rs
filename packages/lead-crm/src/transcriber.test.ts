import { describe, expect, it, vi } from 'vitest';
import { createTranscriber, DEFAULT_TRANSCRIBE_MODEL } from './transcriber.ts';

const VOICE = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);

function transcriberAnswering(body: unknown) {
  const fetch = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  return { transcribe: createTranscriber({ apiKey: 'test', fetch }), fetch };
}

describe('createTranscriber', () => {
  it('uploads the voice as an .ogg file and returns the trimmed transcript', async () => {
    const { transcribe, fetch } = transcriberAnswering({
      text: ' Иван, триста евро. ',
    });

    await expect(transcribe(VOICE)).resolves.toBe('Иван, триста евро.');

    const [, init] = fetch.mock.calls.find(([url]) =>
      String(url).endsWith('/audio/transcriptions'),
    )!;
    const form = init?.body as FormData;
    expect(form.get('model')).toBe(DEFAULT_TRANSCRIBE_MODEL);
    const file = form.get('file') as File;
    expect(file.name).toBe('voice.ogg');
    expect(file.type).toBe('audio/ogg');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(VOICE);
  });

  it('refuses a reply without a transcript', async () => {
    const { transcribe } = transcriberAnswering({ error: 'nothing' });

    await expect(transcribe(VOICE)).rejects.toThrow();
  });
});
