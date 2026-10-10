import { describe, expect, it, vi } from 'vitest';
import { createPayoutParser } from './payoutParser.ts';

const BRANDS = {
  'Approved.rs': 'car selection and import',
  CarLab: 'car service and parts',
  Details: 'detailing',
};

function completion(content: string, finishReason = 'stop') {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-recorded',
      object: 'chat.completion',
      created: 1760000000,
      model: 'gpt-4o-mini-2024-07-18',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content, refusal: null },
          logprobs: null,
          finish_reason: finishReason,
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function parserAnswering(content: string, finishReason?: string) {
  const fetch = vi.fn(async () => completion(content, finishReason));
  const parse = createPayoutParser({ apiKey: 'test', brands: BRANDS, fetch });
  return { parse, fetch };
}

const recorded = (reply: Record<string, unknown>) =>
  JSON.stringify({
    isPayout: true,
    amount: null,
    note: '',
    clientName: null,
    clientPhone: null,
    brand: null,
    ...reply,
  });

describe('createPayoutParser', () => {
  it.each([
    [
      'a Russian repeat visit',
      'Иван, сервис повторно, 30',
      recorded({
        amount: 30,
        note: 'сервис повторно',
        clientName: 'Иван',
        brand: 'CarLab',
      }),
      {
        amount: 30,
        note: 'сервис повторно',
        clientName: 'Иван',
        clientPhone: null,
        brand: 'CarLab',
      },
    ],
    [
      'a Russian voice transcript with the amount in words',
      'Петрову за подбор пятьсот евро скинул телефон плюс три восемь один шесть четыре один два три четыре пять шесть семь',
      recorded({
        amount: 500,
        note: 'за подбор',
        clientName: 'Петров',
        clientPhone: '+381641234567',
        brand: 'Approved.rs',
      }),
      {
        amount: 500,
        note: 'за подбор',
        clientName: 'Петров',
        clientPhone: '+381641234567',
        brand: 'Approved.rs',
      },
    ],
    [
      'a Serbian detailing job',
      'Marko poliranje 45e',
      recorded({
        amount: 45,
        note: 'poliranje',
        clientName: 'Marko',
        brand: 'Details',
      }),
      {
        amount: 45,
        note: 'poliranje',
        clientName: 'Marko',
        clientPhone: null,
        brand: 'Details',
      },
    ],
    [
      'a Russian teen amount in words',
      'Сергею пятнадцать за диагностику',
      recorded({ amount: 15, note: 'за диагностику', clientName: 'Сергей' }),
      {
        amount: 15,
        note: 'за диагностику',
        clientName: 'Сергей',
        clientPhone: null,
        brand: null,
      },
    ],
    [
      'a Russian unit amount in words',
      'Олег, пять',
      recorded({ amount: 5, clientName: 'Олег' }),
      {
        amount: 5,
        note: '',
        clientName: 'Олег',
        clientPhone: null,
        brand: null,
      },
    ],
    [
      'a Serbian unit amount in words',
      'Jovan osam evra',
      recorded({ amount: 8, clientName: 'Jovan' }),
      {
        amount: 8,
        note: '',
        clientName: 'Jovan',
        clientPhone: null,
        brand: null,
      },
    ],
    [
      'a Serbian transcript with a phone and no name',
      'delovi za kupca sa brojem 064 123 4567 sto dvadeset',
      recorded({
        amount: 120,
        note: 'delovi ',
        clientName: ' ',
        clientPhone: '064 123 4567',
      }),
      {
        amount: 120,
        note: 'delovi',
        clientName: null,
        clientPhone: '064 123 4567',
        brand: null,
      },
    ],
  ])('reads %s into a draft', async (_case, text, content, expected) => {
    const { parse } = parserAnswering(content);
    expect(await parse(text)).toEqual(expected);
  });

  it.each([
    [
      'a meeting time',
      'Завтра в 10 у сервиса',
      recorded({ isPayout: false, amount: null }),
    ],
    [
      'a quoted price',
      'Klijent pita za Golf 2019, nudi 9500',
      recorded({ isPayout: false, amount: 9500 }),
    ],
    ['a zero', 'Иван 0', recorded({ amount: 0 })],
    ['an absurd amount', 'Иван 5000000', recorded({ amount: 5_000_000 })],
  ])('drops %s', async (_case, text, content) => {
    const { parse } = parserAnswering(content);
    expect(await parse(text)).toBeNull();
  });

  it('never asks the model about a message without a word or a digit', async () => {
    const { parse, fetch } = parserAnswering(recorded({ amount: 30 }));
    expect(await parse('👍 ?!')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('asks the model about number words, not only digits', async () => {
    const { parse, fetch } = parserAnswering(recorded({ amount: 15 }));
    await parse('Марко petnaest');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('gives no brand hint and takes no brand when there are no brands', async () => {
    const fetch = vi.fn(async () =>
      completion(recorded({ amount: 30, brand: null })),
    );
    const parse = createPayoutParser({ apiKey: 'test', brands: {}, fetch });

    expect(await parse('Иван 30')).toMatchObject({ amount: 30, brand: null });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).not.toContain('- brand:');
    expect(
      body.response_format.json_schema.schema.properties.brand,
    ).toMatchObject({ type: 'null' });
  });

  it('sends the brands and asks for a strict schema', async () => {
    const { parse, fetch } = parserAnswering(recorded({ amount: 30 }));
    await parse('Иван 30');
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'payout', strict: true },
    });
    expect(body.messages[0].content).toContain(
      '- CarLab: car service and parts',
    );
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Иван 30' });
  });

  it('throws on a reply that breaks the schema', async () => {
    const { parse } = parserAnswering(recorded({ amount: 30, brand: 'Audi' }));
    await expect(parse('Иван 30')).rejects.toThrow();
  });

  it('throws on a reply cut off at the token limit', async () => {
    const { parse } = parserAnswering('{"isPayout": tr', 'length');
    await expect(parse('Иван 30')).rejects.toThrow();
  });
});
