-- SynthCamp Phase 2 Migration 9 — generic set_updated_at trigger function + attach to mutable tables

CREATE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER releases_set_updated_at
  BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER listening_parties_set_updated_at
  BEFORE UPDATE ON public.listening_parties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
