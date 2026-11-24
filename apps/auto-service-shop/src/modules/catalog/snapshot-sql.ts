export const SNAPSHOT_FITMENTS = `
  select id, part_id, vehicle_id, quantity, axle, side,
    production_from, production_to, gearbox, steering, note, translations
  from fitment
  where deleted_at is null and id > ?
  order by id
  limit ?`;

export const SNAPSHOT_VEHICLES = `
  select v.id, v.slug, v.power_kw, v.drive, v.market,
    v.year_from, v.year_to, v.steering,
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
      'displacement_cc', e.displacement_cc)
    end as engine,
    coalesce((
      select json_agg(json_build_object('type', i.type, 'value', i.value)
        order by i.id)
      from vehicle_identifier i
      where i.vehicle_id = v.id and i.deleted_at is null and i.type <> ?
    ), '[]') as identifiers,
    coalesce((
      select json_agg(json_build_object(
          'id', r.id, 'category_id', f.category_id, 'field_key', f.key,
          'option_keys', r.option_keys, 'min', r.min, 'max', r.max,
          'quantity', r.quantity)
        order by r.engine_id is null, r.chassis_id is null, r.id)
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
  where v.deleted_at is null and v.id > ?
  order by v.id
  limit ?`;
