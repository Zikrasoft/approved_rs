import type CatalogModuleService from '../../modules/catalog/service';
import { fitmentConflicts } from '../fitment-conflicts';
import { slugOf } from '../slug';
import type { VehicleFacts } from './adapter';

type Years = { year_from: number | null; year_to: number | null };

type Candidate = Years & {
  id: string;
  power_kw: number | null;
  model: {
    chassis: { code: string; series: { make: { slug: string } } };
  };
};

export type VehicleMatcher = {
  catalog: CatalogModuleService;
  source: string;
  engines: { id: string; key: string }[] | null;
  found: Map<string, string[]>;
};

export const vehicleMatcher = (
  catalog: CatalogModuleService,
  source: string,
): VehicleMatcher => ({ catalog, source, engines: null, found: new Map() });

const codeKey = (code: string) => code.replace(/[\s-]+/gu, '').toUpperCase();

const nameKey = (name: string) =>
  name.replace(/\s+/gu, ' ').trim().toLowerCase();

const familyOf = (code: string) =>
  /^[A-Z]{1,3}\d{2,3}/u.exec(codeKey(code))?.[0] ?? codeKey(code);

const chassisCodesOf = (facts: VehicleFacts) =>
  facts.chassis_codes.length ? facts.chassis_codes : [facts.model];

const overlaps = (a: Years, b: Years) =>
  (a.year_from ?? -Infinity) <= (b.year_to ?? Infinity) &&
  (b.year_from ?? -Infinity) <= (a.year_to ?? Infinity);

const sameCar =
  (facts: VehicleFacts) =>
  (vehicle: Candidate): boolean => {
    const codes = new Set(chassisCodesOf(facts).map(codeKey));
    return (
      vehicle.model.chassis.series.make.slug === slugOf(facts.make) &&
      (vehicle.power_kw === null ||
        facts.power_kw === null ||
        vehicle.power_kw === facts.power_kw) &&
      overlaps(vehicle, facts) &&
      vehicle.model.chassis.code
        .split(/[/,]/u)
        .some((code) => codes.has(codeKey(code)))
    );
  };

async function enginesOf(matcher: VehicleMatcher) {
  matcher.engines ??= (
    await matcher.catalog.listEngines(
      {},
      { select: ['id', 'code'], take: null },
    )
  ).map(({ id, code }) => ({ id, key: codeKey(code) }));
  return matcher.engines;
}

const sameEngine = (code: string) => {
  const key = codeKey(code);
  return (engine: { key: string }) =>
    engine.key === key ||
    familyOf(engine.key) === key ||
    engine.key === familyOf(key);
};

async function engineOf(
  matcher: VehicleMatcher,
  code: string,
  facts: VehicleFacts,
): Promise<string> {
  const engines = await enginesOf(matcher);
  const known = engines.find(({ key }) => key === codeKey(code));
  if (known) return known.id;
  const created = await matcher.catalog.createEngines({
    code,
    family: familyOf(code),
    fuel: facts.fuel,
    displacement_cc: facts.displacement_cc,
    source: matcher.source,
  });
  engines.push({ id: created.id, key: codeKey(code) });
  return created.id;
}

async function makeOf({ catalog, source }: VehicleMatcher, name: string) {
  const slug = slugOf(name);
  const [known] = await catalog.listMakes({ slug }, { take: 1 });
  return known ?? catalog.createMakes({ slug, name, source });
}

async function seriesOf(
  { catalog, source }: VehicleMatcher,
  makeId: string,
  name: string,
) {
  const known = (
    await catalog.listSeries({ make_id: makeId }, { take: null })
  ).find((series) => nameKey(series.name) === nameKey(name));
  return known ?? catalog.createSeries({ make_id: makeId, name, source });
}

async function chassisOf(
  matcher: VehicleMatcher,
  makeId: string,
  facts: VehicleFacts,
) {
  const { catalog, source } = matcher;
  const codes = chassisCodesOf(facts).join('/');
  for (const code of [codes, `${facts.make} ${codes}`]) {
    const [known] = await catalog.listChassis(
      { code },
      { relations: ['series'], take: 1 },
    );
    if (known?.series.make_id === makeId) return known;
    if (!known) {
      const series = await seriesOf(matcher, makeId, facts.model);
      return catalog.createChassis({
        series_id: series.id,
        code,
        body_style: facts.body_style,
        source,
      });
    }
  }
  throw new Error(`Chassis ${codes} is taken by another make`);
}

async function freeModelSlug(catalog: CatalogModuleService, name: string) {
  for (let attempt = 1; ; attempt += 1) {
    const slug = attempt > 1 ? `${slugOf(name)}-${attempt}` : slugOf(name);
    const [, taken] = await catalog.listAndCountVehicleModels(
      { slug },
      { select: ['id'], take: 1 },
    );
    if (!taken) return slug;
  }
}

async function modelOf(matcher: VehicleMatcher, facts: VehicleFacts) {
  const { catalog, source } = matcher;
  const make = await makeOf(matcher, facts.make);
  const chassis = await chassisOf(matcher, make.id, facts);
  const known = (
    await catalog.listVehicleModels({ chassis_id: chassis.id }, { take: null })
  ).find((model) => nameKey(model.name) === nameKey(facts.variant));
  return (
    known ??
    catalog.createVehicleModels({
      chassis_id: chassis.id,
      name: facts.variant,
      slug: await freeModelSlug(
        catalog,
        `${facts.make} ${chassis.code} ${facts.variant}`,
      ),
      source,
    })
  );
}

async function vehicleOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
  code: string,
): Promise<string> {
  const { catalog, source } = matcher;
  const engineIds = (await enginesOf(matcher))
    .filter(sameEngine(code))
    .map(({ id }) => id);
  const candidates: Candidate[] = engineIds.length
    ? await catalog.listVehicles(
        { engine_id: engineIds },
        {
          relations: ['model.chassis.series.make'],
          take: null,
        },
      )
    : [];
  const known = candidates.find(sameCar(facts));
  if (known) return known.id;
  const vehicle = await catalog.createVehicles({
    model_id: (await modelOf(matcher, facts)).id,
    engine_id: await engineOf(matcher, code, facts),
    power_kw: facts.power_kw,
    year_from: facts.year_from,
    year_to: facts.year_to,
    source,
  });
  return vehicle.id;
}

async function vehiclesOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
): Promise<string[]> {
  const key = JSON.stringify({ ...facts, notes: [] });
  const found = matcher.found.get(key);
  if (found) return found;
  const ids: string[] = [];
  for (const code of facts.engine_codes) {
    ids.push(await vehicleOf(matcher, facts, code));
  }
  matcher.found.set(key, ids);
  return ids;
}

async function dropUnlisted(
  { catalog, source }: VehicleMatcher,
  partId: string,
  listed: Set<string>,
): Promise<void> {
  const unlisted = (
    await catalog.listFitments(
      { part_id: partId, source },
      { select: ['id', 'vehicle_id'], take: null },
    )
  ).filter(({ vehicle_id }) => !listed.has(vehicle_id));
  if (!unlisted.length) return;
  await catalog.deleteFitments(unlisted.map(({ id }) => id));
  const vehicleIds = unlisted.map(({ vehicle_id }) => vehicle_id);
  const byVehicle = { vehicle_id: vehicleIds };
  const columns = { select: ['vehicle_id'], take: null };
  const held = new Set(
    [
      ...(await catalog.listFitments(byVehicle, {
        ...columns,
        withDeleted: true,
      })),
      ...(await catalog.listRequirements(byVehicle, columns)),
      ...(await catalog.listVehicleIdentifiers(byVehicle, columns)),
    ].map(({ vehicle_id }) => vehicle_id),
  );
  const orphans = (
    await catalog.listVehicles(
      { id: vehicleIds, source },
      { select: ['id'], take: null },
    )
  ).filter(({ id }) => !held.has(id));
  if (orphans.length) {
    await catalog.deleteVehicles(orphans.map(({ id }) => id));
  }
}

export async function fitVehicles(
  matcher: VehicleMatcher,
  partId: string,
  facts: VehicleFacts[],
): Promise<void> {
  const { catalog, source } = matcher;
  const notes = new Map<string, string | null>();
  for (const row of facts) {
    for (const id of await vehiclesOf(matcher, row)) {
      if (!notes.has(id)) notes.set(id, row.notes.join('; ') || null);
    }
  }
  await dropUnlisted(matcher, partId, new Set(notes.keys()));
  if (!notes.size) return;
  const fitted = new Set(
    (
      await catalog.listFitments(
        { part_id: partId, vehicle_id: [...notes.keys()] },
        { select: ['vehicle_id'], take: null, withDeleted: true },
      )
    ).map(({ vehicle_id }) => vehicle_id),
  );
  const fitting: { vehicle_id: string; note: string | null }[] = [];
  for (const [vehicleId, note] of notes) {
    if (fitted.has(vehicleId)) continue;
    const conflicts = await fitmentConflicts(catalog, partId, {
      vehicle_id: vehicleId,
    });
    if (!conflicts.length) fitting.push({ vehicle_id: vehicleId, note });
  }
  if (fitting.length) {
    await catalog.createFitments(
      fitting.map((fitment) => ({ ...fitment, part_id: partId, source })),
    );
  }
}
