import { SUPPLIER_VEHICLE_ID } from '@podbor/catalog-contract';

import type CatalogModuleService from '../../modules/catalog/service';
import { canonicalChassisCode } from '../chassis-code';
import { fitmentConflicts } from '../fitment-conflicts';
import { slugOf } from '../slug';
import type { VehicleFacts } from './adapter';
import { spellingKey } from './spelling';

type Years = { year_from: number | null; year_to: number | null };

type Candidate = Years & {
  id: string;
  power_kw: number | null;
  model: {
    chassis: { code: string; series: { make_id: string } };
  };
};

type Make = { id: string; name: string };

export type VehicleMatcher = {
  catalog: CatalogModuleService;
  source: string;
  supplierId: string;
  makes: Map<string, Make>;
  engines: { id: string; key: string }[] | null;
  found: Map<string, string[]>;
};

export const vehicleMatcher = (
  catalog: CatalogModuleService,
  source: string,
  supplierId: string,
): VehicleMatcher => ({
  catalog,
  source,
  supplierId,
  makes: new Map(),
  engines: null,
  found: new Map(),
});

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
  (facts: VehicleFacts, makeId: string) =>
  (vehicle: Candidate): boolean => {
    const codes = new Set(chassisCodesOf(facts).map(codeKey));
    return (
      vehicle.model.chassis.series.make_id === makeId &&
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

const canonicalMakeName = (spelling: string) =>
  spelling
    .replace(/\([^)]*\)/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim() || spelling.trim();

async function knownMake(
  { catalog, supplierId }: VehicleMatcher,
  key: string,
  name: string,
): Promise<{ make: Make; spelled: boolean } | null> {
  const [own] = await catalog.listMakeSpellings(
    { supplier_id: supplierId, value_key: key },
    { relations: ['make'], take: 1 },
  );
  if (own) return { make: own.make, spelled: true };
  const [aliased] = await catalog.listMakeSpellings(
    { value_key: [key, spellingKey(name)] },
    { relations: ['make'], take: 1 },
  );
  if (aliased) return { make: aliased.make, spelled: false };
  const [named] = await catalog.listMakes({ slug: slugOf(name) }, { take: 1 });
  return named ? { make: named, spelled: false } : null;
}

async function makeOf(matcher: VehicleMatcher, spelling: string) {
  const key = spellingKey(spelling);
  const cached = matcher.makes.get(key);
  if (cached) return cached;
  const { catalog, source, supplierId } = matcher;
  const name = canonicalMakeName(spelling);
  const known = await knownMake(matcher, key, name);
  const make =
    known?.make ??
    (await catalog.createMakes({ slug: slugOf(name), name, source }));
  if (!known?.spelled) {
    await catalog.createMakeSpellings({
      make_id: make.id,
      supplier_id: supplierId,
      value: spelling,
      source,
    });
  }
  matcher.makes.set(key, make);
  return make;
}

async function chassisOf(
  { catalog, source }: VehicleMatcher,
  make: Make,
  facts: VehicleFacts,
) {
  const code = canonicalChassisCode(chassisCodesOf(facts).join('/'));
  const series = await catalog.listSeries({ make_id: make.id }, { take: null });
  const [known] = series.length
    ? await catalog.listChassis(
        { series_id: series.map(({ id }) => id), code },
        { take: 1 },
      )
    : [];
  if (known) return known;
  const named =
    series.find(({ name }) => nameKey(name) === nameKey(facts.model)) ??
    (await catalog.createSeries({
      make_id: make.id,
      name: facts.model,
      source,
    }));
  return catalog.createChassis({
    series_id: named.id,
    code,
    body_style: facts.body_style,
    source,
  });
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

async function modelOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
  make: Make,
) {
  const { catalog, source } = matcher;
  const chassis = await chassisOf(matcher, make, facts);
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
        `${make.name} ${chassis.code} ${facts.variant}`,
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
  const make = await makeOf(matcher, facts.make);
  const engineIds = (await enginesOf(matcher))
    .filter(sameEngine(code))
    .map(({ id }) => id);
  const candidates: Candidate[] = engineIds.length
    ? await catalog.listVehicles(
        { engine_id: engineIds },
        {
          relations: ['model.chassis.series'],
          take: null,
        },
      )
    : [];
  const known = candidates.find(sameCar(facts, make.id));
  if (known) return known.id;
  const vehicle = await catalog.createVehicles({
    model_id: (await modelOf(matcher, facts, make)).id,
    engine_id: await engineOf(matcher, code, facts),
    power_kw: facts.power_kw,
    year_from: facts.year_from,
    year_to: facts.year_to,
    source,
  });
  return vehicle.id;
}

async function vehicleBySupplierId(
  { catalog, supplierId }: VehicleMatcher,
  value: string,
) {
  const [known] = await catalog.listVehicleIdentifiers(
    { type: SUPPLIER_VEHICLE_ID, supplier_id: supplierId, value },
    { select: ['vehicle_id'], take: 1 },
  );
  return known?.vehicle_id;
}

async function vehiclesOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
): Promise<string[]> {
  const key = JSON.stringify({ ...facts, notes: [] });
  const found = matcher.found.get(key);
  if (found) return found;
  const { catalog, source, supplierId } = matcher;
  const supplierVehicleId =
    facts.engine_codes.length === 1 ? facts.supplier_vehicle_id : undefined;
  const known =
    supplierVehicleId &&
    (await vehicleBySupplierId(matcher, supplierVehicleId));
  const ids: string[] = known ? [known] : [];
  for (const code of known ? [] : facts.engine_codes) {
    ids.push(await vehicleOf(matcher, facts, code));
  }
  if (supplierVehicleId && !known) {
    await catalog.createVehicleIdentifiers({
      vehicle_id: ids[0],
      type: SUPPLIER_VEHICLE_ID,
      supplier_id: supplierId,
      value: supplierVehicleId,
      source,
    });
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
      ...(await catalog.listVehicleIdentifiers(
        { ...byVehicle, supplier_id: null },
        columns,
      )),
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
