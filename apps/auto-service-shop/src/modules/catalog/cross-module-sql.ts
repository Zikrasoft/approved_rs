export const PUBLISH_ALL = `
  insert into published_number (id)
  select id from part_identifier where deleted_at is null
  on conflict (id) do nothing
  returning id`;

export const REFRESH_LISTED = `
  update published_number pn set listed = l.listed, updated_at = now()
  from (
    select pi.id, not (
      exists (
        select 1 from part_identifier r
        join published_number rp on rp.id = r.id and rp.deleted_at is null
        where r.part_id = p.replaced_by_id and r.deleted_at is null
      ) or (pi.superseded and exists (
        select 1 from part_identifier s
        join published_number sp on sp.id = s.id and sp.deleted_at is null
        where s.part_id = pi.part_id and s.id <> pi.id
          and not s.superseded and s.deleted_at is null
      ))
    ) as listed
    from part_identifier pi
    join part p on p.id = pi.part_id and p.deleted_at is null
    where pi.deleted_at is null
  ) l
  where pn.id = l.id and pn.listed is distinct from l.listed`;

export const PUBLISHED_PAGE = `
  select pn.id, pn.listed from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  where pn.deleted_at is null and (?::text is null or pn.id > ?)
  order by pn.id
  limit ?`;

export const LISTED_PART_COUNTS = `
  with listed as (
    select distinct pi.part_id from part_identifier pi
    join published_number pn on pn.id = pi.id
      and pn.deleted_at is null and pn.listed
    where pi.deleted_at is null
  ), places as (
    select v.model_id, x.vehicle_id, x.part_id, x.category_id, x.fitted
    from (
      select vehicle_id, part_id, null::text as category_id, true as fitted
      from fitment where deleted_at is null
      union all
      select vehicle_id, part_id, category_id, false
      from unnest(?::text[], ?::text[], ?::text[])
        as r(vehicle_id, part_id, category_id)
    ) x
    join listed l on l.part_id = x.part_id
    join vehicle v on v.id = x.vehicle_id and v.deleted_at is null
  ), vehicle_matches as (
    select vehicle_id, category_id, count(distinct part_id) as matches
    from places where not fitted group by vehicle_id, category_id
  ), model_matches as (
    select model_id, category_id, count(distinct part_id) as matches
    from places where not fitted group by model_id, category_id
  )
  select p.model_id, p.vehicle_id,
    (count(distinct p.part_id) filter (where p.fitted or m.matches >= ?))::int as parts,
    coalesce(max(m.matches), 0)::int as required
  from places p
  left join vehicle_matches m on not p.fitted
    and m.vehicle_id = p.vehicle_id and m.category_id = p.category_id
  group by p.model_id, p.vehicle_id
  union all
  select p.model_id, null,
    (count(distinct p.part_id) filter (where p.fitted or m.matches >= ?))::int,
    coalesce(max(m.matches), 0)::int
  from places p
  left join model_matches m on not p.fitted
    and m.model_id = p.model_id and m.category_id = p.category_id
  group by p.model_id`;

export const UNRESOLVED_VIN_CODES = `
  with hits as (
    select l.make_key, l.code, h.source, h.created_at, h.visitor_id,
      h.source = 'storefront' and h.bot is not true
        and (h.visitor_id is null or h.visitor_id <> all(?::text[])) as customer
    from vin_lookup l
    join vin_lookup_hit h on h.vin_lookup_id = l.id and h.deleted_at is null
    where l.vehicle_id is null and l.make_key is not null and l.code is not null
      and l.deleted_at is null
      and not exists (
        select 1 from vehicle_identifier vi
        where vi.type = l.code_type and vi.value = l.code
          and vi.supplier_id is null and vi.deleted_at is null
      )
  )
  select make_key, code, count(*)::int as count,
    (count(*) filter (where customer))::int as customers,
    coalesce(array_agg(distinct left(visitor_id, 8))
      filter (where customer and visitor_id is not null), '{}') as visitors,
    (count(*) filter (where source = 'storefront'))::int as storefront,
    (count(*) filter (where source = 'workshop-quote'))::int as workshop_quote,
    (count(*) filter (where source = 'admin'))::int as admin,
    max(created_at) as last_seen,
    (count(*) over ())::int as total
  from hits
  group by make_key, code
  having ?::boolean or bool_or(customer)
  order by customers desc, count desc, make_key, code
  offset ? limit ?`;

const missingIdentifier = (column: string) =>
  `not exists (select 1 from part_identifier p where p.id = ${column} and p.deleted_at is null)`;

export const ORPHAN_SWEEPS = [
  `delete from supplier_offer o where ${missingIdentifier('o.part_identifier_id')}`,
  `delete from staged_record r where ${missingIdentifier('r.part_identifier_id')}`,
  `delete from published_number n where ${missingIdentifier('n.id')}`,
  `delete from supplier_category s where s.category_id is not null and not exists
   (select 1 from category c where c.id = s.category_id and c.deleted_at is null)`,
  `update vin_lookup l set vehicle_id = null where vehicle_id is not null
   and not exists (select 1 from vehicle v where v.id = l.vehicle_id and v.deleted_at is null)`,
];
