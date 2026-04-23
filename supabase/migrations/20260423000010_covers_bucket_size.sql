-- SynthCamp — bump covers bucket file size limit from 5 MB to 10 MB.
-- 5 MB was too tight for modern cover art (PNG artwork at 1400x1400
-- frequently exceeds it). 10 MB leaves headroom without inviting abuse.

UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'covers';
