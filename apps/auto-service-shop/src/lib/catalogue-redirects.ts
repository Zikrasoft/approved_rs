import {
  type CataloguePlace,
  type CatalogueRedirect,
  cataloguePlaceSchema,
} from '@podbor/catalog-contract';

import type CatalogModuleService from '../modules/catalog/service';
import type { SlugKind } from '../modules/catalog/models/slug-redirect';

type Slugs = Map<string, string>;

const slugsOf = (rows: { id: string; slug: string }[]): Slugs =>
  new Map(rows.map(({ id, slug }) => [id, slug]));

export async function catalogueRedirects(
  catalog: CatalogModuleService,
): Promise<CatalogueRedirect[]> {
  const rows = await catalog.listSlugRedirects(
    {},
    { order: { created_at: 'ASC' }, take: null },
  );
  const columns = { select: ['id', 'slug'], take: null };
  const targetIds = (kind: SlugKind) =>
    rows.flatMap(({ target_kind, target_id }) =>
      target_kind === kind && target_id ? [target_id] : [],
    );
  const vehicleIds = targetIds('vehicle');
  const vehicles = vehicleIds.length
    ? await catalog.listVehicles(
        { id: vehicleIds },
        { select: ['id', 'slug', 'model_id'], take: null },
      )
    : [];
  const modelIds = [
    ...targetIds('model'),
    ...rows.flatMap(({ kind, scope_id }) =>
      kind === 'vehicle' && scope_id ? [scope_id] : [],
    ),
    ...vehicles.map(({ model_id }) => model_id),
  ];
  const models = modelIds.length
    ? await catalog.listVehicleModels(
        { id: modelIds },
        { relations: ['chassis.series'], take: null },
      )
    : [];
  const [makes, categories, brands] = await Promise.all([
    catalog.listMakes({}, columns),
    catalog.listCategories({}, columns),
    catalog.listBrands({}, columns),
  ]);
  const slugs: Record<'make' | 'category' | 'brand', Slugs> = {
    make: slugsOf(makes),
    category: slugsOf(categories),
    brand: slugsOf(brands),
  };
  const modelById = new Map(models.map((model) => [model.id, model]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const placeOf = (
    kind: SlugKind | null,
    id: string | null,
  ): Partial<CataloguePlace> | null => {
    if (!kind || !id) return {};
    if (kind === 'make' || kind === 'category' || kind === 'brand') {
      const slug = slugs[kind].get(id);
      return slug ? { [kind]: slug } : null;
    }
    if (kind === 'model') {
      const model = modelById.get(id);
      const make = model && placeOf('make', model.chassis.series.make_id);
      return make && model ? { ...make, model: model.slug } : null;
    }
    if (kind === 'vehicle') {
      const vehicle = vehicleById.get(id);
      const model = vehicle && placeOf('model', vehicle.model_id);
      return model && vehicle ? { ...model, vehicle: vehicle.slug } : null;
    }
    return null;
  };

  const retiredModels = new Map(
    rows.flatMap((row) => (row.kind === 'model' ? [[row.from_id, row]] : [])),
  );

  const fromOf = ({
    kind,
    from_slug,
    scope_id,
  }: (typeof rows)[number]): Partial<CataloguePlace> | null => {
    if (kind === 'model') {
      const make = placeOf('make', scope_id);
      return make && { ...make, model: from_slug };
    }
    if (kind === 'vehicle') {
      const retired = scope_id ? retiredModels.get(scope_id) : undefined;
      const model =
        placeOf('model', scope_id) ?? (retired ? fromOf(retired) : null);
      return model && { ...model, vehicle: from_slug };
    }
    return { [kind]: from_slug };
  };

  return rows.flatMap((row) => {
    const from = fromOf(row);
    const to = placeOf(row.target_kind, row.target_id);
    return from && to
      ? [
          {
            from: cataloguePlaceSchema.parse(from),
            to: cataloguePlaceSchema.parse(to),
          },
        ]
      : [];
  });
}
