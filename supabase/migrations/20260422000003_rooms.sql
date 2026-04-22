-- SynthCamp Phase 2 Migration 3 — rooms table (seeded)

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  kind room_kind NOT NULL,
  display_order integer NOT NULL
);

INSERT INTO public.rooms (slug, name, kind, display_order) VALUES
  ('global-master', 'Global Master Channel', 'global_master', 1),
  ('secondary-1', 'Secondary 1', 'secondary', 2),
  ('secondary-2', 'Secondary 2', 'secondary', 3);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY rooms_select_public ON public.rooms FOR SELECT USING (true);
