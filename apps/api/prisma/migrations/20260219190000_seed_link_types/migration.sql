-- Seed default link types
-- Each pair shares a LinkType row: outward = source side, inward = target side
-- getLinkTypeByName searches name, inward, and outward columns

INSERT INTO "link_types" ("id", "name", "inward", "outward", "description")
VALUES
  (uuid_generate_v4(), 'blocks',      'is_blocked_by',    'blocks',       'One issue blocks another'),
  (uuid_generate_v4(), 'duplicates',  'is_duplicated_by', 'duplicates',   'One issue duplicates another'),
  (uuid_generate_v4(), 'relates_to',  'relates_to',       'relates_to',   'Issues are related'),
  (uuid_generate_v4(), 'causes',      'is_caused_by',     'causes',       'One issue causes another'),
  (uuid_generate_v4(), 'clones',      'is_cloned_by',     'clones',       'One issue is a clone of another')
ON CONFLICT ("name") DO NOTHING;
