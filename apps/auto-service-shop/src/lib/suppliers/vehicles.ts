import type { Context } from '@medusajs/framework/types';
import { SUPPLIER_VEHICLE_ID } from '@podbor/catalog-contract';

import type CatalogModuleService from '../../modules/catalog/service';
import type { Provenance } from '../../modules/catalog/service';
import { canonicalChassisCode } from '../chassis-code';
import { conflictingVehicles } from '../fitment-conflicts';
import type { VehicleFacts } from './adapter';
import { carMakeName } from './makes';
import { codeKey, nameKey, variantKey } from '../../modules/_shared/keys';

type Years = { year_from: number | null; year_to: number | null };

type Power = { power_kw: number | null };

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
  makes: Map<string, Make | null>;
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

const familyOf = (code: string) =>
  /^[A-Z]{1,3}\d{2,3}/u.exec(codeKey(code))?.[0] ?? codeKey(code);

const chassisCodesOf = (facts: VehicleFacts) =>
  facts.chassis_codes.length ? facts.chassis_codes : [facts.model];

const overlaps = (a: Years, b: Years) =>
  (a.year_from ?? -Infinity) <= (b.year_to ?? Infinity) &&
  (b.year_from ?? -Infinity) <= (a.year_to ?? Infinity);

const samePower = (vehicle: Power, car: Power) =>
  vehicle.power_kw === null ||
  car.power_kw === null ||
  vehicle.power_kw === car.power_kw;

const sameCar =
  (facts: VehicleFacts, makeId: string) =>
  (vehicle: Candidate): boolean => {
    const codes = new Set(chassisCodesOf(facts).map(codeKey));
    return (
      vehicle.model.chassis.series.make_id === makeId &&
      samePower(vehicle, facts) &&
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
    { value_key: [key, nameKey(name)] },
    { relations: ['make'], take: 1 },
  );
  if (aliased) return { make: aliased.make, spelled: false };
  const named = (
    await catalog.listMakes({}, { select: ['id', 'name'], take: null })
  ).find((make) => nameKey(make.name) === nameKey(name));
  return named ? { make: named, spelled: false } : null;
}

async function makeOf(
  matcher: VehicleMatcher,
  spelling: string,
): Promise<Make | null> {
  const key = nameKey(spelling);
  if (matcher.makes.has(key)) return matcher.makes.get(key) ?? null;
  const { catalog, source, supplierId } = matcher;
  const name = carMakeName(spelling);
  const known = await knownMake(matcher, key, name ?? spelling);
  const make =
    known?.make ?? (name && (await catalog.createMakes({ name, source })));
  if (!make) {
    matcher.makes.set(key, null);
    return null;
  }
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
  const known = series.length
    ? (
        await catalog.listChassis(
          { series_id: series.map(({ id }) => id) },
          { take: null },
        )
      ).find((chassis) => codeKey(chassis.code) === codeKey(code))
    : undefined;
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

async function modelOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
  make: Make,
) {
  const { catalog, source } = matcher;
  const chassis = await chassisOf(matcher, make, facts);
  const known = (
    await catalog.listVehicleModels({ chassis_id: chassis.id }, { take: null })
  ).find((model) => variantKey(model.name) === variantKey(facts.variant));
  return (
    known ??
    catalog.createVehicleModels({
      chassis_id: chassis.id,
      name: facts.variant,
      source,
    })
  );
}

export async function engineLessVehicle(
  catalog: CatalogModuleService,
  car: Years & Power & Provenance & { model_id: string },
  context?: Context,
): Promise<string> {
  const known = (
    await catalog.listVehicles(
      { model_id: car.model_id, engine_id: null },
      { take: null },
      context,
    )
  ).find((vehicle) => samePower(vehicle, car) && overlaps(vehicle, car));
  if (known) return known.id;
  const vehicle = await catalog.createVehicles(
    { ...car, engine_id: null },
    context,
  );
  return vehicle.id;
}

async function engineLessVehicleOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
  make: Make,
): Promise<string> {
  const model = await modelOf(matcher, facts, make);
  return engineLessVehicle(matcher.catalog, {
    model_id: model.id,
    power_kw: facts.power_kw,
    year_from: facts.year_from,
    year_to: facts.year_to,
    source: matcher.source,
  });
}

async function vehicleOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
  make: Make,
  code: string | null,
): Promise<string> {
  if (code === null) return engineLessVehicleOf(matcher, facts, make);
  const { catalog, source } = matcher;
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

const supplierVehicleIdOf = (
  supplierVehicleId: string,
  code: string | null,
  codes: number,
) => (codes > 1 ? `${supplierVehicleId}:${code}` : supplierVehicleId);

async function vehiclesOf(
  matcher: VehicleMatcher,
  facts: VehicleFacts,
): Promise<string[]> {
  const key = JSON.stringify({ ...facts, notes: [] });
  const found = matcher.found.get(key);
  if (found) return found;
  const make = await makeOf(matcher, facts.make);
  if (!make) return [];
  const { catalog, source, supplierId } = matcher;
  const codes = facts.engine_codes.length ? facts.engine_codes : [null];
  const ids: string[] = [];
  for (const code of codes) {
    const value =
      facts.supplier_vehicle_id &&
      supplierVehicleIdOf(facts.supplier_vehicle_id, code, codes.length);
    const known = value && (await vehicleBySupplierId(matcher, value));
    const id = known || (await vehicleOf(matcher, facts, make, code));
    ids.push(id);
    if (value && !known) {
      await catalog.createVehicleIdentifiers({
        vehicle_id: id,
        type: SUPPLIER_VEHICLE_ID,
        supplier_id: supplierId,
        value,
        source,
      });
    }
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
  await catalog.deleteOrphanVehicles(
    unlisted.map(({ vehicle_id }) => vehicle_id),
    source,
  );
}

export async function fitVehicles(
  matcher: VehicleMatcher,
  partId: string,
  facts: VehicleFacts[],
): Promise<{ noMake: number }> {
  const { catalog, source } = matcher;
  const notes = new Map<string, string | null>();
  let noMake = 0;
  for (const row of facts) {
    for (const id of await vehiclesOf(matcher, row)) {
      if (!notes.has(id)) notes.set(id, row.notes.join('; ') || null);
    }
    const unknownMake =
      row.engine_codes.length > 0 &&
      matcher.makes.get(nameKey(row.make)) === null;
    if (unknownMake) noMake += 1;
  }
  await dropUnlisted(matcher, partId, new Set(notes.keys()));
  if (!notes.size) return { noMake };
  const fitted = new Set(
    (
      await catalog.listFitments(
        { part_id: partId, vehicle_id: [...notes.keys()] },
        { select: ['vehicle_id'], take: null, withDeleted: true },
      )
    ).map(({ vehicle_id }) => vehicle_id),
  );
  const unfitted = [...notes.keys()].filter((id) => !fitted.has(id));
  const conflicting = await conflictingVehicles(catalog, partId, unfitted);
  const fitting = unfitted
    .filter((id) => !conflicting.has(id))
    .map((id) => ({ vehicle_id: id, note: notes.get(id) ?? null }));
  if (fitting.length) {
    await catalog.createFitments(
      fitting.map((fitment) => ({ ...fitment, part_id: partId, source })),
    );
  }
  return { noMake };
}
