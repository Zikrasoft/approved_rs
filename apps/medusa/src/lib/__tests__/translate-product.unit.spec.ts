import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import { batchTranslationsWorkflow } from '@medusajs/medusa/core-flows';
import { translateFields } from '@podbor/i18n/translate/core';

import { updateProductMetadata } from '../metadata';
import { productSource, sourceHash } from '../product-source';
import { translateProduct } from '../translate-product';

jest.mock('@medusajs/medusa/core-flows', () => ({
  batchTranslationsWorkflow: jest.fn(),
}));
jest.mock('@podbor/i18n/translate/core', () => ({
  ...jest.requireActual('@podbor/i18n/translate/core'),
  translateFields: jest.fn(),
}));
jest.mock('../metadata', () => ({ updateProductMetadata: jest.fn() }));

const PRODUCT = {
  id: 'prod_1',
  title: 'Аккумулятор Varta',
  subtitle: null,
  description: 'Для **VW**',
  metadata: { spec: { brand: 'Varta' } },
};

const HASH = sourceHash(productSource(PRODUCT));

const stamped = (stamps: Record<string, string>) => ({
  ...PRODUCT,
  metadata: { ...PRODUCT.metadata, ...stamps },
});

const run = jest.fn().mockResolvedValue({});
let existing: Record<string, { id: string }[]>;

const containerFor = (rows: unknown[] = [PRODUCT]) => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: logger,
    [ContainerRegistrationKeys.QUERY]: {
      graph: jest.fn().mockResolvedValue({ data: rows }),
    },
    [Modules.TRANSLATION]: {
      listTranslations: jest.fn(
        async ({ locale_code }: { locale_code: string }) =>
          existing[locale_code] ?? [],
      ),
    },
  };
  return {
    logger,
    container: { resolve: (key: string) => services[key] } as never,
  };
};

const echo = async ({
  fields,
  targetLocales: [locale],
}: {
  fields: Record<string, string>;
  targetLocales: string[];
}) => ({
  [locale]: Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, `${locale}: ${value}`]),
  ),
});

beforeEach(() => {
  jest.clearAllMocks();
  existing = {};
  process.env.OPENAI_API_KEY = 'sk-test';
  (batchTranslationsWorkflow as unknown as jest.Mock).mockReturnValue({ run });
  (translateFields as jest.Mock).mockImplementation(echo);
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe('translateProduct', () => {
  it('does nothing when the Russian text is what was translated last', async () => {
    const { container } = containerFor([
      stamped({ translated_from_sr: HASH, translated_from_en: HASH }),
    ]);

    expect(await translateProduct(container, 'prod_1')).toBe('current');
    expect(translateFields).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('waits for a key instead of failing', async () => {
    delete process.env.OPENAI_API_KEY;
    const { container, logger } = containerFor();

    expect(await translateProduct(container, 'prod_1')).toBe('no-key');
    expect(translateFields).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('OPENAI_API_KEY'),
    );
  });

  it('reports a product that is gone', async () => {
    const { container } = containerFor([]);

    expect(await translateProduct(container, 'prod_gone')).toBe('missing');
  });

  it('translates each language in its own request, writes through the workflow and stamps the hash', async () => {
    const { container } = containerFor();

    expect(await translateProduct(container, 'prod_1')).toBe('translated');

    const calls = (translateFields as jest.Mock).mock.calls.map(
      ([options]) => options,
    );
    expect(calls.map((options) => options.targetLocales)).toEqual([
      ['sr'],
      ['en'],
    ]);
    expect(calls[0]).toMatchObject({
      fields: { title: 'Аккумулятор Varta', description: 'Для **VW**' },
      apiKey: 'sk-test',
      languageName: { sr: 'Serbian (Latin script)', en: 'English' },
    });
    expect(run).toHaveBeenCalledWith({
      input: {
        create: [
          {
            reference: 'product',
            reference_id: 'prod_1',
            locale_code: 'sr-RS',
            translations: {
              title: 'sr: Аккумулятор Varta',
              description: 'sr: Для **VW**',
            },
          },
        ],
        update: [],
        delete: [],
      },
    });
    expect(run).toHaveBeenCalledWith({
      input: {
        create: [expect.objectContaining({ locale_code: 'en-US' })],
        update: [],
        delete: [],
      },
    });
    expect(updateProductMetadata).toHaveBeenCalledWith(container, 'prod_1', {
      translated_from_sr: HASH,
      translated_from_en: HASH,
    });
  });

  it('updates the translation a language already has', async () => {
    existing['sr-RS'] = [{ id: 'tr_sr' }];
    const { container } = containerFor();

    await translateProduct(container, 'prod_1');

    expect(run).toHaveBeenCalledWith({
      input: {
        create: [],
        update: [
          {
            id: 'tr_sr',
            translations: {
              title: 'sr: Аккумулятор Varta',
              description: 'sr: Для **VW**',
            },
          },
        ],
        delete: [],
      },
    });
  });

  it('keeps the language that worked when the other fails, and stamps only that one', async () => {
    (translateFields as jest.Mock).mockImplementation(async (options) => {
      if (options.targetLocales[0] === 'en') {
        throw new Error('model answered off-contract');
      }
      return echo(options);
    });
    const { container, logger } = containerFor();

    expect(await translateProduct(container, 'prod_1')).toBe('failed');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0].input.create[0].locale_code).toBe('sr-RS');
    expect(updateProductMetadata).toHaveBeenCalledWith(container, 'prod_1', {
      translated_from_sr: HASH,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('into en'),
    );
  });

  it('retries only the language still behind, leaving the other untouched', async () => {
    const { container } = containerFor([stamped({ translated_from_sr: HASH })]);

    expect(await translateProduct(container, 'prod_1')).toBe('translated');

    const calls = (translateFields as jest.Mock).mock.calls;
    expect(calls.map(([options]) => options.targetLocales)).toEqual([['en']]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0].input.create[0].locale_code).toBe('en-US');
    expect(updateProductMetadata).toHaveBeenCalledWith(container, 'prod_1', {
      translated_from_en: HASH,
    });
  });

  it('writes nothing when every language fails', async () => {
    (translateFields as jest.Mock).mockRejectedValue(new Error('down'));
    const { container } = containerFor();

    expect(await translateProduct(container, 'prod_1')).toBe('failed');
    expect(updateProductMetadata).not.toHaveBeenCalled();
  });

  it('retranslates a language whose stamp is from older Russian', async () => {
    const { container } = containerFor([
      stamped({ translated_from_sr: 'older', translated_from_en: HASH }),
    ]);

    await translateProduct(container, 'prod_1');

    const calls = (translateFields as jest.Mock).mock.calls;
    expect(calls.map(([options]) => options.targetLocales)).toEqual([['sr']]);
  });

  it('reports a product deleted mid-translation as missing instead of throwing', async () => {
    (updateProductMetadata as jest.Mock).mockRejectedValue(
      new MedusaError(MedusaError.Types.NOT_FOUND, 'Nothing to update'),
    );
    const { container, logger } = containerFor();

    expect(await translateProduct(container, 'prod_1')).toBe('missing');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('prod_1'));
  });

  it('still throws a stamp failure that is not a vanished product', async () => {
    (updateProductMetadata as jest.Mock).mockRejectedValue(
      new Error('db down'),
    );
    const { container } = containerFor();

    await expect(translateProduct(container, 'prod_1')).rejects.toThrow(
      'db down',
    );
  });
});
