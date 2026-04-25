-- SynthCamp Phase 3 — auto-enqueue encode jobs on track audio_source_key set.
--
-- On INSERT (new track) and on UPDATE OF audio_source_key (artist replaced
-- the audio after a failed encode), enqueue a 'full' job. On UPDATE OF
-- preview_start_seconds (artist scrubbed the timeline), enqueue only a
-- 'preview' job and collapse stale pending preview jobs for the same track.

CREATE OR REPLACE FUNCTION public.enqueue_track_encode_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- New audio source → re-encode everything. encode_status defaults to
  -- 'pending' on the new row already; no extra UPDATE needed.
  IF TG_OP = 'INSERT' AND NEW.audio_source_key IS NOT NULL THEN
    INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'full');
    INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'preview');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Audio replaced → full re-encode.
    IF NEW.audio_source_key IS DISTINCT FROM OLD.audio_source_key
       AND NEW.audio_source_key IS NOT NULL THEN
      INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'full');
      INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'preview');
      UPDATE public.tracks SET encode_status = 'pending' WHERE id = NEW.id;
      RETURN NEW;
    END IF;

    -- Preview window changed → preview-only re-encode, collapse stale jobs.
    IF NEW.preview_start_seconds IS DISTINCT FROM OLD.preview_start_seconds
       OR NEW.preview_enabled IS DISTINCT FROM OLD.preview_enabled THEN
      DELETE FROM public.encode_jobs
      WHERE track_id = NEW.id
        AND kind = 'preview'
        AND status = 'pending';
      INSERT INTO public.encode_jobs (track_id, kind) VALUES (NEW.id, 'preview');
      RETURN NEW;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tracks_enqueue_encode ON public.tracks;
CREATE TRIGGER trg_tracks_enqueue_encode
  AFTER INSERT OR UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_track_encode_jobs();
