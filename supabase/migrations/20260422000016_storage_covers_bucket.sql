-- SynthCamp Phase 2 Migration 16 — Supabase Storage bucket for release covers

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers',
  'covers',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read (covers are marketplace-visible)
CREATE POLICY covers_public_read ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

-- Upload restricted: path must start with 'artist_<user-id>/'
CREATE POLICY covers_upload_own ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = 'artist_' || auth.uid()::text
  );

-- Update restricted to own paths (in case user replaces a cover)
CREATE POLICY covers_update_own ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = 'artist_' || auth.uid()::text
  );

-- Delete restricted to own paths
CREATE POLICY covers_delete_own ON storage.objects FOR DELETE
  USING (
    bucket_id = 'covers'
    AND (storage.foldername(name))[1] = 'artist_' || auth.uid()::text
  );
