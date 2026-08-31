-- Tags were trimmed but never lowercased, so "Design" and "design" are two
-- distinct tags. A tag index would show both forever, so existing rows collapse
-- to the same normal form the client now writes.

-- coalesce matters: unnest of an empty array yields no rows, array_agg over no
-- rows returns null, and without it every untagged note would have its tags
-- set to null instead of staying an empty array.
update public.notes
set tags = coalesce(
  (
    select array_agg(distinct lower(btrim(tag)))
    from unnest(tags) as tag
    where btrim(tag) <> ''
  ),
  '{}'
)
where tags is not null
  and exists (
    select 1
    from unnest(tags) as tag
    where tag <> lower(btrim(tag)) or btrim(tag) = ''
  );
