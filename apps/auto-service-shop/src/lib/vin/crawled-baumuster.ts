import type CatalogModuleService from '../../modules/catalog/service';

const PARENTHESES = /\(([^)]*)\)/g;
const BAUMUSTER_LIST = /(?<![\d.])(\d{3})\.(\d{3}(?:\/\d{3})*)(?![\d.])/g;

export const baumusterInModelName = (name: string): string[] =>
  [...name.matchAll(PARENTHESES)].flatMap(([, listed]) =>
    [...listed.matchAll(BAUMUSTER_LIST)].flatMap(([, series, variants]) =>
      variants.split('/').map((variant) => series + variant),
    ),
  );

export const modelsListingBaumuster = async (
  catalog: CatalogModuleService,
  make: string,
  baumuster: string,
): Promise<string[]> =>
  (
    await catalog.listVehicleModels(
      { name: { $ilike: `%${baumuster.slice(0, 3)}.%` } },
      { relations: ['chassis.series.make'], take: null },
    )
  )
    .filter(
      ({ name, chassis }) =>
        chassis.series.make.slug === make &&
        baumusterInModelName(name).includes(baumuster),
    )
    .map(({ id }) => id);
