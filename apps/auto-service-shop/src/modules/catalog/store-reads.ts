export type StoreRowFilter = {
  id?: string[];
  model_id?: string[];
  series_id?: string[];
};

export type FitmentFilter = { part_id?: string[]; vehicle_id?: string[] };

export const FITMENT_ROWS = `
  select id, part_id, vehicle_id, quantity, axle, side, production_from,
    production_to, gearbox, steering, note, translations
  from fitment
  where deleted_at is null
    and (:parts::text[] is null or part_id = any(:parts::text[]))
    and (:vehicles::text[] is null or vehicle_id = any(:vehicles::text[]))
  order by id`;

export const VEHICLE_ROWS = `
  select v.id, v.slug, v.power_kw, v.drive, v.market, v.year_from, v.year_to,
    v.steering, c.series_id,
    json_build_object(
      'slug', m.slug, 'name', m.name,
      'chassis', json_build_object(
        'code', c.code, 'body_style', c.body_style,
        'series', json_build_object(
          'name', s.name, 'translations', s.translations,
          'make', json_build_object('slug', mk.slug, 'name', mk.name)))
    ) as model,
    case when e.id is null then null else json_build_object(
      'code', e.code, 'family', e.family, 'fuel', e.fuel,
      'displacement_cc', e.displacement_cc) end as engine,
    coalesce((
      select json_agg(json_build_object('type', i.type, 'value', i.value)
        order by i.id)
      from vehicle_identifier i
      where i.vehicle_id = v.id and i.deleted_at is null
        and i.type <> :supplier
    ), '[]') as identifiers,
    coalesce((
      select json_agg(json_build_object(
          'id', r.id, 'option_keys', r.option_keys, 'min', r.min,
          'max', r.max, 'quantity', r.quantity, 'field_key', f.key,
          'category_id', f.category_id)
        order by case when r.engine_id is not null then 0
          when r.chassis_id is not null then 1 else 2 end, r.id)
      from requirement r
      join category_field f on f.id = r.field_id and f.deleted_at is null
      where r.deleted_at is null
        and (r.engine_id = e.id or r.chassis_id = c.id or r.vehicle_id = v.id)
    ), '[]') as requirements
  from vehicle v
  join vehicle_model m on m.id = v.model_id and m.deleted_at is null
  join chassis c on c.id = m.chassis_id and c.deleted_at is null
  join series s on s.id = c.series_id and s.deleted_at is null
  join make mk on mk.id = s.make_id and mk.deleted_at is null
  left join engine e on e.id = v.engine_id and e.deleted_at is null
  where v.deleted_at is null
    and (:ids::text[] is null or v.id = any(:ids::text[]))
    and (:models::text[] is null or v.model_id = any(:models::text[]))
    and (:series::text[] is null or c.series_id = any(:series::text[]))
  order by v.id`;

export type PartPageRow = {
  id: string;
  type: string;
  value: string;
  normalized_value: string;
  superseded: boolean;
  images: unknown;
  part_id: string;
  brand: { name: string; slug: string };
  part: {
    id: string;
    name: string;
    description: string | null;
    translations: unknown;
    replaced_by_id: string | null;
    category_id: string | null;
    attributes: unknown;
    installation_price: number | null;
    no_installation: boolean;
    category: { installation_price: number | null } | null;
  };
};

export const PART_PAGE_ROWS = `
  select pi.id, pi.type, pi.value, pi.normalized_value, pi.superseded,
    pi.images, pi.part_id,
    json_build_object('name', b.name, 'slug', b.slug) as brand,
    json_build_object(
      'id', p.id, 'name', p.name, 'description', p.description,
      'translations', p.translations, 'replaced_by_id', p.replaced_by_id,
      'category_id', p.category_id, 'attributes', p.attributes,
      'installation_price', p.installation_price,
      'no_installation', p.no_installation,
      'category', case when c.id is null then null
        else json_build_object('installation_price', c.installation_price) end
    ) as part
  from part_identifier pi
  join brand b on b.id = pi.brand_id and b.deleted_at is null
  join part p on p.id = pi.part_id and p.deleted_at is null
  left join category c on c.id = p.category_id and c.deleted_at is null
  where pi.deleted_at is null and pi.part_id in (
    select part_id from part_identifier
    where id = any(:ids::text[]) and deleted_at is null
  )
  order by pi.id`;
