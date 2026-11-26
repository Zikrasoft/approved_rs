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
  where pn.id = l.id and pn.listed is distinct from l.listed
  returning pn.id`;

export const PUBLISHED_PAGE = `
  select pn.id, pn.listed from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  where pn.deleted_at is null and (?::text is null or pn.id > ?)
  order by pn.id
  limit ?`;

const INDEXABLE = `(
    coalesce(p.description, '') ~ '\\S'
    or exists (
      select 1 from jsonb_each(coalesce(p.attributes, '{}'::jsonb)) a
      where not (jsonb_typeof(a.value) in ('string', 'array')
        and a.value in ('""'::jsonb, '[]'::jsonb))
    )
    or exists (
      select 1 from fitment f
      join vehicle v on v.id = f.vehicle_id and v.deleted_at is null
      where f.part_id = p.id and f.deleted_at is null
    )
    or exists (
      select 1 from part_identifier o
      where o.part_id = p.id and o.id <> pi.id and o.deleted_at is null
    )
  ) as indexable`;

export const PUBLISHED_NUMBER_BY_SLUG = `
  select pn.id, pn.listed, ${INDEXABLE} from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  join brand b on b.id = pi.brand_id and b.deleted_at is null
  join part p on p.id = pi.part_id and p.deleted_at is null
  where pn.deleted_at is null and b.slug = ? and pi.normalized_value = ?
  order by pn.id
  limit 1`;

export const PUBLISHED_NUMBERS = `
  select pn.id, pn.listed from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  where pn.deleted_at is null and pn.id = any(?::text[])
  order by pn.id`;

export const LISTED_PARTS_IN_CATEGORY = `
  select p.id, p.category_id, p.attributes from part p
  join part_identifier pi on pi.part_id = p.id and pi.deleted_at is null
  join published_number pn on pn.id = pi.id and pn.deleted_at is null
  where p.deleted_at is null and p.category_id = ?
  group by p.id
  having bool_or(pn.listed)
  order by min(pn.id)`;

const LIVE_VEHICLES = `
    select v.id as vehicle_id, v.engine_id, m.id as model_id, m.chassis_id,
      c.series_id
    from vehicle v
    join vehicle_model m on m.id = v.model_id and m.deleted_at is null
    join chassis c on c.id = m.chassis_id and c.deleted_at is null
    where v.deleted_at is null`;

const demandsOf = (requirements: string) => `
    select s.vehicle_id, r.field_id, r.option_keys, r.min, r.max
    from ${requirements} r join scoped s on s.vehicle_id = r.vehicle_id
    where r.deleted_at is null
    union all
    select s.vehicle_id, r.field_id, r.option_keys, r.min, r.max
    from ${requirements} r
    join engine e on e.id = r.engine_id and e.deleted_at is null
    join scoped s on s.engine_id = e.id
    where r.deleted_at is null
    union all
    select s.vehicle_id, r.field_id, r.option_keys, r.min, r.max
    from ${requirements} r join scoped s on s.chassis_id = r.chassis_id
    where r.deleted_at is null`;

const REQUIREMENTS_MET = `bool_and(case
      when jsonb_typeof(p.attributes -> cf.key) = 'number'
        then (p.attributes ->> cf.key)::numeric
          between coalesce(d.min, '-Infinity') and coalesce(d.max, 'Infinity')
      when jsonb_typeof(p.attributes -> cf.key) = 'array'
        then jsonb_exists_any(p.attributes -> cf.key, coalesce(d.option_keys, '{}'))
      when jsonb_typeof(p.attributes -> cf.key) in ('string', 'boolean')
        then p.attributes ->> cf.key = any(coalesce(d.option_keys, '{}'))
      else false
    end)`;

export const PART_REQUIREMENT_FITS = `
  with parts as (
    select p.id, p.category_id, p.attributes from part p
    where p.deleted_at is null and p.id = any(?::text[])
  ), fields as (
    select cf.id, cf.key, cf.category_id from category_field cf
    where cf.deleted_at is null
      and cf.category_id in (select category_id from parts)
  ), owners as (
    select r.* from requirement r
    join fields f on f.id = r.field_id
    where r.deleted_at is null
  ), scoped as (${LIVE_VEHICLES}
      and (v.id in (select vehicle_id from owners)
        or v.engine_id in (select engine_id from owners)
        or m.chassis_id in (select chassis_id from owners))
  ), demands as (${demandsOf('owners')}
  )
  select d.vehicle_id, p.id as part_id, p.category_id
  from demands d
  join fields cf on cf.id = d.field_id
  join parts p on p.category_id = cf.category_id
  group by d.vehicle_id, p.id, p.category_id
  having ${REQUIREMENTS_MET}
  order by d.vehicle_id, p.id`;

const LISTED_PLACES = `
  with listed as (
    select distinct pi.part_id from part_identifier pi
    join published_number pn on pn.id = pi.id
      and pn.deleted_at is null and pn.listed
    where pi.deleted_at is null
  ), scoped as (${LIVE_VEHICLES}
      and (:series::text[] is null or c.series_id = any(:series::text[]))
  ), demands as (${demandsOf('requirement')}
  ), required as (
    select d.vehicle_id, p.id as part_id, p.category_id
    from demands d
    join category_field cf on cf.id = d.field_id and cf.deleted_at is null
    join part p on p.category_id = cf.category_id and p.deleted_at is null
    join listed l on l.part_id = p.id
    group by d.vehicle_id, p.id, p.category_id
    having ${REQUIREMENTS_MET}
  ), places as (
    select s.series_id, s.model_id, s.vehicle_id, f.id as fitment_id,
      f.part_id, pt.category_id, true as fitted
    from scoped s
    join fitment f on f.vehicle_id = s.vehicle_id and f.deleted_at is null
    join listed l on l.part_id = f.part_id
    left join part pt on pt.id = f.part_id
    union all
    select s.series_id, s.model_id, s.vehicle_id, null, r.part_id,
      r.category_id, false
    from required r join scoped s on s.vehicle_id = r.vehicle_id
  )`;

export const LISTED_MAKE_PART_COUNTS = `${LISTED_PLACES}, scoped_places as (
    select p.model_id, p.part_id, p.category_id, p.fitted, s.make_id
    from places p
    join series s on s.id = p.series_id and s.deleted_at is null
  ), model_matches as (
    select model_id, category_id, count(distinct part_id) as matches
    from scoped_places where not fitted group by model_id, category_id
  ), kept as (
    select sc.model_id
    from scoped_places sc
    left join model_matches mm on not sc.fitted
      and mm.model_id = sc.model_id and mm.category_id = sc.category_id
    group by sc.model_id
    having count(distinct sc.part_id)
      filter (where sc.fitted
        or mm.matches >= :min_matches) > 0
  ), make_matches as (
    select make_id, category_id, count(distinct part_id) as matches
    from scoped_places
    where not fitted and model_id in (select model_id from kept)
    group by make_id, category_id
  )
  select mk.slug as make_slug,
    (count(distinct sc.part_id)
      filter (where sc.fitted
        or mm.matches >= :min_matches))::int as parts
  from scoped_places sc
  join kept k on k.model_id = sc.model_id
  join make mk on mk.id = sc.make_id
  left join make_matches mm on not sc.fitted
    and mm.make_id = sc.make_id and mm.category_id = sc.category_id
  group by mk.slug`;

export const LISTED_SERIES_CATEGORY_COUNTS = `${LISTED_PLACES}
  select series_id, category_id, count(*)::int as parts,
    (count(*) filter (where fitted))::int as fitted,
    (count(*) filter (where required))::int as required
  from (
    select series_id, category_id, bool_or(fitted) as fitted,
      bool_or(not fitted) as required
    from places
    group by series_id, category_id, part_id
  ) held
  group by series_id, category_id`;

export const LISTED_CATEGORY_PARTS = `${LISTED_PLACES}
  select category_id, part_id, min(fitment_id) as first_fitment_id
  from places
  where category_id is not null
  group by category_id, part_id
  order by category_id, part_id`;

export const LISTED_VEHICLE_PARTS = `${LISTED_PLACES}
  select vehicle_id, part_id, category_id, fitted
  from places
  group by vehicle_id, part_id, category_id, fitted
  order by vehicle_id, part_id`;

export const PUBLISHED_PART_SLUGS = `
  select b.slug as brand_slug, pi.normalized_value, ${INDEXABLE}
  from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  join brand b on b.id = pi.brand_id and b.deleted_at is null
  join part p on p.id = pi.part_id and p.deleted_at is null
  where pn.deleted_at is null
  order by pn.id`;

export const PART_PAGE_COUNTS = `
  select
    (select count(distinct (b.slug, pi.normalized_value))
      from published_number pn
      join part_identifier pi on pi.id = pn.id
      join brand b on b.id = pi.brand_id
      where pn.deleted_at is null)::int as published,
    (select count(distinct (b.slug, pi.normalized_value))
      from part_identifier pi
      join brand b on b.id = pi.brand_id and b.deleted_at is null
      join part p on p.id = pi.part_id and p.deleted_at is null
      where pi.deleted_at is null)::int as projected`;

export const LISTED_NUMBERS = `
  select pn.id, b.slug as brand_slug, b.name as brand_name,
    pi.normalized_value, p.id as part_id, p.category_id, p.attributes
  from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  join brand b on b.id = pi.brand_id and b.deleted_at is null
  join part p on p.id = pi.part_id and p.deleted_at is null
  where pn.deleted_at is null and pn.listed and p.category_id is not null
  order by pn.id`;

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
  `delete from published_number n where ${missingIdentifier('n.id')} returning n.id`,
  `delete from supplier_category s where s.category_id is not null and not exists
   (select 1 from category c where c.id = s.category_id and c.deleted_at is null)`,
  `update vin_lookup l set vehicle_id = null where vehicle_id is not null
   and not exists (select 1 from vehicle v where v.id = l.vehicle_id and v.deleted_at is null)`,
];
