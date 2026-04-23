-- Diagnostic: what dummy/seed data exists?
SELECT 'profiles (seed-*)' AS what, count(*) AS n FROM profiles WHERE slug LIKE 'seed-%'
UNION ALL SELECT 'profiles (any)', count(*) FROM profiles
UNION ALL SELECT 'releases (any)', count(*) FROM releases
UNION ALL SELECT 'releases published', count(*) FROM releases WHERE status = 'published'
UNION ALL SELECT 'listening_parties (any)', count(*) FROM listening_parties
UNION ALL SELECT 'rooms (any)', count(*) FROM rooms;

SELECT slug, display_name, is_artist FROM profiles ORDER BY created_at DESC LIMIT 10;
SELECT id, slug, status FROM releases ORDER BY created_at DESC LIMIT 5;
